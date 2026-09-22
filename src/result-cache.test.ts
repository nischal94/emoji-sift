import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResultCache, MAX_ENTRIES } from './result-cache.ts';
import { normalizeQuery } from './sift.ts';

const response = (n: number) => ({
  matches: [{ id: `e${n}`, char: '🔑', score: 2.5 }],
  ms: n,
});

test('a stored response comes back', () => {
  const cache = new ResultCache();
  cache.set('wear', response(1));
  assert.deepEqual(cache.get('wear'), response(1));
});

test('an absent key returns undefined, not a throw', () => {
  const cache = new ResultCache();
  assert.equal(cache.get('never stored'), undefined);
});

test('the oldest entry is evicted once the cap is passed', () => {
  const cache = new ResultCache(3);
  cache.set('a', response(1));
  cache.set('b', response(2));
  cache.set('c', response(3));
  cache.set('d', response(4));

  assert.equal(cache.size, 3, 'the cap must hold');
  assert.equal(cache.get('a'), undefined, 'the oldest must be gone');
  assert.deepEqual(cache.get('d'), response(4), 'the newest must be kept');
});

test('reading an entry protects it from the next eviction', () => {
  // The defect this guards: with a plain insertion-order eviction, the query
  // being asked repeatedly is dropped by a burst of one-off ones, which is
  // exactly backwards.
  const cache = new ResultCache(3);
  cache.set('a', response(1));
  cache.set('b', response(2));
  cache.set('c', response(3));

  cache.get('a'); // 'a' is now the most recently used.
  cache.set('d', response(4));

  assert.deepEqual(cache.get('a'), response(1), 'the read entry must survive');
  assert.equal(cache.get('b'), undefined, 'the untouched one goes instead');
});

test('overwriting a key does not keep its old position', () => {
  const cache = new ResultCache(2);
  cache.set('a', response(1));
  cache.set('b', response(2));
  cache.set('a', response(9)); // 'a' becomes newest, so 'b' is next out.
  cache.set('c', response(3));

  assert.deepEqual(cache.get('a'), response(9), 'the overwrite is kept');
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.size, 2);
});

test('clear empties the cache', () => {
  const cache = new ResultCache();
  cache.set('a', response(1));
  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.get('a'), undefined);
});

test('the default cap is the exported constant', () => {
  const cache = new ResultCache();
  for (let i = 0; i < MAX_ENTRIES + 10; i++) cache.set(`q${i}`, response(i));
  assert.equal(cache.size, MAX_ENTRIES);
});

test('spacing differences share one entry', () => {
  // The point of keying on the normalized query: the server must not pay
  // again for the same words typed with different spacing.
  const cache = new ResultCache();
  cache.set(normalizeQuery('things you can wear'), response(1));

  assert.deepEqual(
    cache.get(normalizeQuery('  things   you can wear ')),
    response(1),
  );
});

test('case differences do NOT share an entry', () => {
  // `normalizeQuery` collapses whitespace but preserves case, so the server
  // key is case-sensitive. The client's own cacheKey in web/app.js lowercases
  // and is therefore looser. This test pins the difference rather than
  // asserting the two are interchangeable: a future change that lowercases
  // here should be deliberate, and should turn this red.
  const cache = new ResultCache();
  cache.set(normalizeQuery('things you can wear'), response(1));
  assert.equal(cache.get(normalizeQuery('Things You Can Wear')), undefined);
});

test('queries that differ do not share an entry', () => {
  const cache = new ResultCache();
  cache.set(normalizeQuery('things you can wear'), response(1));
  assert.equal(cache.get(normalizeQuery('things you can weary')), undefined);
});
