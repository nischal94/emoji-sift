/**
 * A bounded in-memory cache of sift responses, keyed on the normalized query.
 *
 * Two reasons it exists. A repeated query costs a full 101-question
 * evaluation (~14,780 tokens) against a model that has one provider and no
 * fallback, so serving it from memory removes both the spend and the wait.
 * And because the key is the NORMALIZED query, the entry is shared across
 * browsers and survives a page reload — the client's own `Map` in
 * `web/app.js` is per-tab and dies with it.
 *
 * Deliberately not a TTL cache. The model's answer to "things you can wear"
 * does not go stale on a clock, and an expiry would reintroduce the wait at
 * an unpredictable moment. Restarting the server is the way to clear it.
 */

/** What the handler sends back, and therefore what is worth storing. */
export interface CachedResponse {
  matches: { id: string; char: string; score: number }[];
  ms: number;
}

/**
 * Entries kept before the oldest is dropped.
 *
 * A cached entry is ~12 matches of three short fields, so 200 entries is
 * well under a megabyte. The cap exists to bound memory against a caller
 * sending endless distinct queries, not because the data is large.
 */
export const MAX_ENTRIES = 200;

export class ResultCache {
  readonly #entries = new Map<string, CachedResponse>();
  readonly #max: number;

  constructor(max: number = MAX_ENTRIES) {
    this.#max = max;
  }

  /** The number of entries held. For tests and diagnostics. */
  get size(): number {
    return this.#entries.size;
  }

  /**
   * Return a stored response, or undefined.
   *
   * A hit is re-inserted so it becomes the most recently used entry: a query
   * that keeps being asked should not be evicted by a burst of one-off ones.
   */
  get(key: string): CachedResponse | undefined {
    const hit = this.#entries.get(key);
    if (hit === undefined) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, hit);
    return hit;
  }

  /**
   * Store a response, evicting the least recently used entry when full.
   *
   * A Map iterates in insertion order, so the first key is the oldest.
   */
  set(key: string, value: CachedResponse): void {
    // Delete first so an overwrite counts as a fresh insertion rather than
    // keeping the original position in the iteration order.
    this.#entries.delete(key);
    this.#entries.set(key, value);

    while (this.#entries.size > this.#max) {
      const oldest = this.#entries.keys().next();
      if (oldest.done === true) break;
      this.#entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.#entries.clear();
  }
}
