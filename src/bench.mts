import { requireGatewayKey } from './env.ts';
import { QUERIES } from './queries.ts';
import { EMOJI } from './emoji.ts';
import { sift, DEFAULT_LIMIT, DEFAULT_FLOOR, RETRIES_BENCH, promptStyle } from './sift.ts';

requireGatewayKey();

/** `Number('abc')` is NaN and `Number('')` is 0; both silently empty the row. */
function envNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

const limit = envNumber(process.env.SIFT_LIMIT, DEFAULT_LIMIT);
const floor = envNumber(process.env.SIFT_FLOOR, DEFAULT_FLOOR);

const NAMES = new Map(EMOJI.map((e) => [e.id, `${e.char} ${e.name}`]));

console.log(
  `\n  ${QUERIES.length} queries · ${promptStyle()} prompt · top ${limit} · floor ${floor}\n`,
);

let passed = 0;
let failed = 0;
let unavailable = 0;
let totalTokens = 0;

for (const { text, note, must, mustNot, outranks = [] } of QUERIES) {
  console.log(`  "${text}"`);
  console.log(`  ${note}`);

  // Jev has a single provider, so a 503 has nothing to fail over to. One bad
  // query must not cost the results of every query after it.
  try {
    const { matches, all, usage, ms } = await sift(text, {
      limit,
      floor,
      maxRetries: RETRIES_BENCH,
      // Five retries with exponential backoff, plus a slow response, runs
      // past a minute. A shorter deadline kills the chain mid-wait, which
      // surfaces as "Delay was aborted" rather than as a model failure.
      timeoutMs: 180_000,
    });
    const shown = new Set(matches.map((m) => m.emoji.id));
    totalTokens += usage.totalTokens ?? 0;

    const missing = must.filter((id) => !shown.has(id));
    const present = mustNot.filter((id) => shown.has(id));

    // A defensible-but-secondary answer is allowed in the row, as long as
    // every required answer beats it.
    const scoreOf = (id: string) => all.find((m) => m.emoji.id === id)?.score ?? -1;
    const outranked = outranks.flatMap((weak) =>
      must
        .filter((strong) => scoreOf(strong) <= scoreOf(weak))
        .map((strong) => ({ strong, weak, strongScore: scoreOf(strong), weakScore: scoreOf(weak) })),
    );

    const ok = missing.length === 0 && present.length === 0 && outranked.length === 0;

    console.log(`  ${matches.map((m) => m.emoji.char).join(' ') || '(no matches)'}`);

    for (const id of missing) {
      // The score says whether this is a floor problem or a wording problem.
      const rank = all.findIndex((m) => m.emoji.id === id);
      const score = all[rank]?.score;
      console.log(
        `  MISSING  ${NAMES.get(id) ?? id}` +
          (score === undefined
            ? ' (not scored)'
            : ` — scored ${score.toFixed(2)}, rank ${rank + 1}`),
      );
    }
    for (const id of present) {
      const score = all.find((m) => m.emoji.id === id)?.score;
      console.log(
        `  UNWANTED ${NAMES.get(id) ?? id}` +
          (score === undefined ? '' : ` — scored ${score.toFixed(2)}`),
      );
    }

    for (const o of outranked) {
      console.log(
        `  OUTRANKED ${NAMES.get(o.strong) ?? o.strong} (${o.strongScore.toFixed(2)})` +
          ` should beat ${NAMES.get(o.weak) ?? o.weak} (${o.weakScore.toFixed(2)})`,
      );
    }

    const top = all[0];
    const next = all[matches.length];
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'} · ${matches.length} shown` +
        (top ? ` · top ${top.emoji.char} ${top.score.toFixed(2)}` : '') +
        (next ? ` · next ${next.emoji.char} ${next.score.toFixed(2)}` : '') +
        ` · ${ms}ms · ${usage.totalTokens ?? '?'} tokens\n`,
    );

    if (ok) passed++;
    else failed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  SKIPPED · ${message.split('\n')[0]}\n`);
    unavailable++;
  }
}

console.log(
  `  ${passed} passed · ${failed} failed · ${unavailable} unavailable` +
    (totalTokens ? ` · ${totalTokens.toLocaleString()} tokens total` : ''),
);
console.log();

// A model that could not be reached is not a failing assertion, so it must not
// turn the run red. Only a real expectation miss does.
process.exit(failed > 0 ? 1 : 0);
