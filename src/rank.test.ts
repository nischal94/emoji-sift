import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank } from './rank.ts';
import type { Emoji } from './emoji.ts';

const PILE: Emoji[] = [
  { id: 'a', char: '🅰️', name: 'alpha' },
  { id: 'b', char: '🅱️', name: 'bravo' },
  { id: 'c', char: '©️', name: 'charlie' },
];

test('ranks highest score first', () => {
  const { all } = rank({ a: { score: 1 }, b: { score: 3 }, c: { score: 2 } }, PILE);
  assert.deepEqual(
    all.map((m) => m.emoji.id),
    ['b', 'c', 'a'],
  );
});

test('drops anything below the floor', () => {
  const { matches } = rank({ a: { score: 2.5 }, b: { score: 1.0 } }, PILE, { floor: 1.8 });
  assert.deepEqual(
    matches.map((m) => m.emoji.id),
    ['a'],
  );
});

test('keeps a score sitting exactly on the floor', () => {
  const { matches } = rank({ a: { score: 1.8 } }, PILE, { floor: 1.8 });
  assert.equal(matches.length, 1, 'the floor is inclusive');
});

test('caps the row at the limit, keeping the best', () => {
  const { matches } = rank({ a: { score: 3 }, b: { score: 2.9 }, c: { score: 2.8 } }, PILE, {
    limit: 2,
    floor: 0,
  });
  assert.deepEqual(
    matches.map((m) => m.emoji.id),
    ['a', 'b'],
  );
});

test('applies the floor before the limit', () => {
  // Two clear the floor and the limit allows three: the row is what qualifies,
  // never padded out with the next-best failures.
  const { matches } = rank({ a: { score: 3 }, b: { score: 2 }, c: { score: 0.5 } }, PILE, {
    limit: 3,
    floor: 1.8,
  });
  assert.equal(matches.length, 2);
});

test('returns nothing when no score clears the floor', () => {
  const { matches, all } = rank({ a: { score: 1 }, b: { score: 0.2 } }, PILE, { floor: 1.8 });
  assert.deepEqual(matches, []);
  assert.equal(all.length, 2, 'all still carries every answer for tuning');
});

test('ignores an id that is not in the pile', () => {
  const { all } = rank({ a: { score: 3 }, ghost: { score: 9 } }, PILE);
  assert.deepEqual(
    all.map((m) => m.emoji.id),
    ['a'],
    'an unknown id would otherwise crash on a non-null assertion',
  );
});

test('ignores malformed scores rather than sorting on them', () => {
  const answers = {
    a: { score: 2.5 },
    b: { score: 'high' as unknown as number },
    c: { score: Number.NaN },
  };
  const { all } = rank(answers, PILE, { floor: 0 });
  assert.deepEqual(
    all.map((m) => m.emoji.id),
    ['a'],
    'a non-finite score sorts unpredictably and must not reach the row',
  );
});

test('ignores an answer with no score field', () => {
  const { all } = rank({ a: {}, b: { score: 1.5 } }, PILE, { floor: 0 });
  assert.deepEqual(
    all.map((m) => m.emoji.id),
    ['b'],
  );
});

test('handles an empty answer set', () => {
  const { matches, all } = rank({}, PILE);
  assert.deepEqual(matches, []);
  assert.deepEqual(all, []);
});

test('rejects scores outside the 0-3 scale', () => {
  // A score above the scale would top the row; one below would sink beneath
  // every real answer. Neither is a value this scale can produce.
  const { all } = rank({ a: { score: 99 }, b: { score: -5 }, c: { score: 2 } }, PILE, {
    floor: 0,
  });
  assert.deepEqual(
    all.map((m) => m.emoji.id),
    ['c'],
  );
});

test('accepts the exact ends of the scale', () => {
  const { all } = rank({ a: { score: 0 }, b: { score: 3 } }, PILE, { floor: 0 });
  assert.equal(all.length, 2, '0 and 3 are valid levels, not out of range');
});

test('breaks ties on pile order, not key order', () => {
  // Object key order follows the API response. Two equal scores must still
  // produce the same row every time.
  const forward = rank({ a: { score: 2 }, b: { score: 2 }, c: { score: 2 } }, PILE, {
    floor: 0,
  });
  const reversed = rank({ c: { score: 2 }, b: { score: 2 }, a: { score: 2 } }, PILE, {
    floor: 0,
  });
  assert.deepEqual(
    forward.all.map((m) => m.emoji.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    reversed.all.map((m) => m.emoji.id),
    forward.all.map((m) => m.emoji.id),
    'the same answers must rank identically whatever order they arrive in',
  );
});
