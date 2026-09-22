import { experimental_evaluate as evaluate } from 'ai';
import { EMOJI, type Emoji } from './emoji.ts';
import { rank, DEFAULT_LIMIT, DEFAULT_FLOOR, type Match } from './rank.ts';

export { DEFAULT_LIMIT, DEFAULT_FLOOR, type Match };

export type SiftResult = {
  /** The top-ranked emoji that also clear the floor, best first. */
  matches: Match[];
  /** Every emoji, ranked. The tuning surface. */
  all: Match[];
  /** Token counts as the provider reported them; any field may be absent. */
  usage: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    totalTokens: number | undefined;
  };
  ms: number;
};

export type SiftOptions = {
  limit?: number;
  floor?: number;
  pile?: readonly Emoji[];
  /**
   * Deadline for the whole operation, retries included — not for one attempt.
   * It has to be long enough to contain the retry chain: a value sized for a
   * single call cancels the retries mid-backoff, which surfaces as "Delay was
   * aborted" rather than as a timeout.
   */
  timeoutMs?: number;
  /** Lets a caller cancel in-flight work, such as a superseded keystroke. */
  signal?: AbortSignal;
  /**
   * Retries after the first attempt. Measured at roughly one 503 in two on
   * identical input, so each caller picks its own trade: a person watching a
   * page wants the retry, a person tuning wants to see the failure.
   */
  maxRetries?: number;
};

/**
 * Retries for an interface someone is watching.
 *
 * Five attempts at an observed ~50% success rate leaves about a 3% chance of
 * showing an error the next attempt would have cleared.
 */
export const RETRIES_INTERACTIVE = 4;

/**
 * Retries for a single ad-hoc query, where a failure is information.
 *
 * Kept low on purpose: when the endpoint is struggling, that is worth seeing
 * rather than hiding behind a long silent wait.
 */
export const RETRIES_DIAGNOSTIC = 1;

/**
 * Retries for a benchmark run.
 *
 * A comparison needs the same queries to answer in both runs. At the observed
 * failure rate two attempts lost six queries of nine, and a benchmark that
 * skips two thirds of its cases compares nothing. Waiting longer is the cost
 * of a result worth reading.
 */
export const RETRIES_BENCH = 5;

/**
 * Longest query accepted.
 *
 * The query now travels in shared state and is sent once, so length no longer
 * multiplies across the pile — a test asserts the payload does not grow with
 * it. The cap stays as the outer bound on what reaches the model at all, and
 * 200 characters is well past any real phrase.
 *
 * It mattered more under the earlier prompt shape, which named the query in
 * every criteria level: ~500 copies, so a 5,000-character query built a 2.5 MB
 * payload. That shape is gone.
 */
export const MAX_QUERY_LENGTH = 200;

export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQueryError';
  }
}

/**
 * Normalize and bound a query before it reaches the prompt.
 *
 * The query is untrusted text that lands inside quoted strings in both the
 * instructions and every criteria level. Stripping quotes and control
 * characters stops it from closing those quotes and reading as instruction
 * text of its own.
 */
export function normalizeQuery(raw: string): string {
  const query = raw
    // Every control and format character, not just the C0 range: U+0085 is a
    // line break in many renderers, the C1 range U+0080-U+009F is invisible,
    // and U+202E/U+2066 reorder text on screen. \p{Cc} covers both control
    // ranges and \p{Cf} covers the format characters.
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    // Quotes delimit the query inside the prompt; a straight quote inside it
    // ends the quoted span early. Curly quotes read the same to a person.
    .replace(/"/g, '”')
    .replace(/\s+/g, ' ')
    .trim();

  if (!query) {
    throw new InvalidQueryError('Query is empty.');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new InvalidQueryError(
      `Query is ${query.length} characters; the maximum is ${MAX_QUERY_LENGTH}.`,
    );
  }
  return query;
}

/**
 * Build one score question per emoji, all against the same state.
 *
 * Levels describe concrete situations so each stands alone, and level 3 names
 * the goal case explicitly — that is where a request like "i need to lose
 * weight" would otherwise lose its best answers.
 *
 * Pass a query that has been through `normalizeQuery`.
 */
/**
 * Build one score question per emoji. The query is NOT interpolated here: it
 * reaches the model only through shared state.
 *
 * `query` is accepted and deliberately unused. It keeps the call sites honest
 * about what is being asked, and it is what the payload-independence test
 * varies to prove the request body does not grow with the user's text.
 *
 * An earlier shape named the query inside every criteria level, about five
 * copies per emoji and roughly 505 across the pile. It was removed after the
 * acceptance set measured the two: same queries passed, 103,460 tokens against
 * 121,336, and 🎻 returned on "start a band" where the repeated shape left it
 * below the floor. Keeping the user's text out of the instructions is also the
 * stronger boundary — escaping quotes does not stop natural-language
 * injection, separating content from instruction does. That boundary is not a
 * setting: there is one shape, so no environment variable can weaken it.
 */
export function buildQuestions(_query: string, pile: readonly Emoji[]) {
  return Object.fromEntries(
    pile.map((e) => [
      e.id,
      {
        type: 'score' as const,
        instructions: `How well does "${e.name}" answer the query in the state?`,
        criteria: [
          `Unrelated. Nobody making that query would want "${e.name}".`,
          `A stretch. "${e.name}" fits only an unusual reading of the query.`,
          `A sensible answer. "${e.name}" is a reasonable thing to offer whoever made that query.`,
          `An obvious answer. "${e.name}" is among the first things to offer them, whether the query named a category, a goal, or a situation.`,
        ],
      },
    ]),
  );
}

/**
 * Rank every emoji against one query in a single request.
 *
 * Ranking rather than a yes/no per emoji is what makes open-ended queries
 * work. "Things that make noise" is true of almost any object and "i need to
 * lose weight" is true of almost none, so a fixed yes/no bar returns 27
 * matches for one and 2 for the other. Ranking asks which emoji answer BEST,
 * which is the question the interface is really posing.
 */
export async function sift(
  rawQuery: string,
  {
    limit = DEFAULT_LIMIT,
    floor = DEFAULT_FLOOR,
    pile = EMOJI,
    timeoutMs = 20_000,
    signal,
    maxRetries = RETRIES_DIAGNOSTIC,
  }: SiftOptions = {},
): Promise<SiftResult> {
  const query = normalizeQuery(rawQuery);
  const questions = buildQuestions(query, pile);

  // Jev has one provider and `fallbacksAvailable: []`, so the gateway cannot
  // route around a bad instance. Measured on five consecutive runs of one
  // query: success, 503, success, 503 — the failures are server-side and
  // independent of the request, which is why retrying is the right response
  // and changing the request is not.
  //
  // `timeoutMs` is a deadline for the whole operation, retries included: the
  // SDK reuses one signal across its retry loop, so this is not a per-attempt
  // budget. That is the behaviour we want here — a caller waiting on a page
  // cares how long the answer takes in total, not how it was divided up — but
  // it does mean the timeout has to exceed the retry chain it contains.
  const started = Date.now();
  const result = await evaluate({
    model: 'typesafe-ai/jev',
    state: { query },
    questions,
    maxRetries,
    abortSignal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
  });
  const ms = Date.now() - started;

  const { matches, all } = rank(result.answers, pile, { limit, floor });

  return { matches, all, usage: result.usage, ms };
}
