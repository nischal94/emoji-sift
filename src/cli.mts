import { createInterface } from 'node:readline/promises';
import { EMOJI } from './emoji.ts';
import { sift, DEFAULT_LIMIT, DEFAULT_FLOOR } from './sift.ts';

import { requireGatewayKey } from './env.ts';

requireGatewayKey();

/** `Number('abc')` is NaN and `Number('')` is 0; both silently empty the row. */
function envNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

const limit = envNumber(process.env.SIFT_LIMIT, DEFAULT_LIMIT);
const floor = envNumber(process.env.SIFT_FLOOR, DEFAULT_FLOOR);

async function run(query: string) {
  try {
    const { matches, all, usage, ms } = await sift(query, { limit, floor });

    console.log(`\n  ${matches.map((m) => m.emoji.char).join(' ') || '(nothing cleared the floor)'}\n`);

    for (const m of matches) {
      console.log(`  ${m.emoji.char}  ${m.score.toFixed(2)}  ${m.emoji.name}`);
    }

    // What sits just outside the row: either a miss, or a correct rejection.
    const nextUp = all.filter((m) => !matches.includes(m)).slice(0, 6);
    if (nextUp.length) {
      console.log(`\n  next in line:`);
      for (const m of nextUp) {
        console.log(`  ${m.emoji.char}  ${m.score.toFixed(2)}  ${m.emoji.name}`);
      }
    }

    console.log(
      `\n  ${matches.length} shown of ${all.length} · ${ms}ms · ${usage.totalTokens ?? '?'} tokens\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`\n  [failed] ${message.split('\n')[0]}\n`);
  }
}

const argQuery = process.argv.slice(2).join(' ').trim();

if (argQuery) {
  await run(argQuery);
} else {
  console.log(`\n  emoji-sift — ${EMOJI.length} emoji, top ${limit}, floor ${floor}`);
  console.log('  Type a description. Ctrl+C to quit.\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    const query = (await rl.question('  > ')).trim();
    if (!query) continue;
    await run(query);
  }
}
