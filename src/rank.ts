import type { Emoji } from './emoji.ts';

/** An emoji with how well it answers the query, on the 0–3 scale. */
export type Match = {
  emoji: Emoji;
  /** Interpolated position across the four levels. */
  score: number;
};

/** Top of the score scale: four levels, 0 through 3. */
export const MAX_SCORE = 3;

/** How many emoji fly up at most. The video shows a single row. */
export const DEFAULT_LIMIT = 12;

/**
 * Minimum score to be shown at all, on the 0–3 scale, so a query with only
 * weak candidates returns few or none rather than padding the row out to
 * `DEFAULT_LIMIT`.
 *
 * Measured rather than guessed. Goal-shaped queries score lower across the
 * board than descriptive ones — "i am hosting a dinner party" tops out around
 * 2.2 where "things you can wear" reaches 2.9 — so a floor at 1.8 cut them to
 * two or three results. At 1.5 those queries roughly double while the strong
 * ones are untouched, because their first rejected answer sits at 1.7-1.8.
 */
export const DEFAULT_FLOOR = 1.5;

/** One answer as the evaluation API returns it, before we trust its shape. */
export type RawAnswer = { score?: unknown };

export type RankOptions = {
  limit?: number;
  floor?: number;
};

/**
 * Turn raw answers into a ranked row.
 *
 * Kept free of the network call so it can be tested directly: this is where
 * an off-by-one in the floor or a bad sort would otherwise hide behind a
 * plausible-looking row of emoji.
 *
 * Answers whose id is not in the pile, or whose score is not a finite number,
 * are dropped rather than trusted. The evaluation API is an external boundary,
 * and a malformed score sorts unpredictably instead of failing loudly.
 */
export function rank(
  answers: Record<string, RawAnswer>,
  pile: readonly Emoji[],
  { limit = DEFAULT_LIMIT, floor = DEFAULT_FLOOR }: RankOptions = {},
): { matches: Match[]; all: Match[] } {
  const byId = new Map(pile.map((e) => [e.id, e]));

  const all: Match[] = [];
  for (const [id, answer] of Object.entries(answers)) {
    const emoji = byId.get(id);
    if (!emoji) continue;

    const score = answer?.score;
    if (typeof score !== 'number' || !Number.isFinite(score)) continue;
    // The scale has four levels, so a score outside 0–3 is not a value this
    // function can rank: it would sort above or below every real answer.
    if (score < 0 || score > MAX_SCORE) continue;

    all.push({ emoji, score });
  }

  // Ties break on the pile's own order rather than on however the API
  // happened to key its response, so the same answers always produce the
  // same row.
  const order = new Map(pile.map((e, i) => [e.id, i]));
  all.sort(
    (a, b) => b.score - a.score || order.get(a.emoji.id)! - order.get(b.emoji.id)!,
  );

  return {
    matches: all.filter((m) => m.score >= floor).slice(0, limit),
    all,
  };
}
