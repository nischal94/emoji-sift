import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMOJI } from './emoji.ts';
import { QUERIES } from './queries.ts';
import { buildQuestions } from './sift.ts';

test('every id is unique', () => {
  // Duplicate ids collide as object keys, so the later question silently
  // replaces the earlier one and that emoji never gets judged.
  const ids = EMOJI.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every char is unique', () => {
  const chars = EMOJI.map((e) => e.char);
  const dupes = chars.filter((c, i) => chars.indexOf(c) !== i);
  assert.deepEqual(dupes, [], 'the same emoji twice is a duplicate row entry');
});

test('every name is unique', () => {
  const names = EMOJI.map((e) => e.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dupes, [], 'two identical names are indistinguishable to the model');
});

test('ids are safe as object keys', () => {
  for (const e of EMOJI) {
    assert.match(e.id, /^[a-z0-9_]+$/, `${e.id} should be lowercase snake_case`);
  }
});

test('names read as plain nouns, not property descriptions', () => {
  // The demo's claim is that Jev reasons about objects rather than matching
  // words we planted. A name carrying the answer ("magnetic key") would make
  // the magnet query pass for the wrong reason.
  for (const e of EMOJI) {
    assert.ok(e.name.length > 0, `${e.id} needs a name`);
    assert.equal(e.name, e.name.toLowerCase(), `${e.name} should be lowercase`);
    assert.ok(e.name.length <= 24, `${e.name} is long enough to be a description`);
  }
});

test('builds one question per emoji', () => {
  const questions = buildQuestions('things you can wear', EMOJI);
  assert.equal(Object.keys(questions).length, EMOJI.length);
});

test('every question carries four ordered levels', () => {
  const questions = buildQuestions('test query', EMOJI.slice(0, 3));
  for (const q of Object.values(questions)) {
    assert.equal(q.type, 'score');
    assert.equal(q.criteria.length, 4, 'the 0-3 scale the floor is calibrated against');
  }
});

test('every acceptance-set id exists in the pile', () => {
  // A typo here would never match anything, so a `must` would fail forever and
  // a `mustNot` would pass forever — both silently.
  const ids = new Set(EMOJI.map((e) => e.id));
  for (const q of QUERIES) {
    for (const id of [...q.must, ...q.mustNot]) {
      assert.ok(ids.has(id), `"${q.text}" references unknown emoji id: ${id}`);
    }
  }
});

test('no query both requires and forbids the same emoji', () => {
  for (const q of QUERIES) {
    const overlap = q.must.filter((id) => q.mustNot.includes(id));
    assert.deepEqual(overlap, [], `"${q.text}" cannot both require and forbid ${overlap.join(', ')}`);
  }
});

test('the query stays out of the questions', () => {
  // The query travels in shared state. Keeping it out of the instructions is
  // both the cheaper payload and the stronger boundary: escaping user text
  // does not stop natural-language injection, separating it does.
  const questions = buildQuestions('things that float', EMOJI.slice(0, 1));
  const q = Object.values(questions)[0]!;
  assert.doesNotMatch(q.instructions, /things that float/);
  for (const level of q.criteria) {
    assert.doesNotMatch(level, /things that float/);
  }
});

test('every question names its own emoji', () => {
  // Each level has to stand alone for the 0-3 scale to mean anything, and the
  // emoji name is what anchors it.
  const questions = buildQuestions('anything', EMOJI.slice(0, 1));
  const [id, q] = Object.entries(questions)[0]!;
  const name = EMOJI.find((e) => e.id === id)!.name;
  assert.match(q.instructions, new RegExp(name));
  for (const level of q.criteria) {
    assert.match(level, new RegExp(name), 'a level with no subject cannot be judged');
  }
});

test('payload does not grow with query length', () => {
  const short = JSON.stringify(buildQuestions('hat', EMOJI)).length;
  const long = JSON.stringify(buildQuestions('a'.repeat(190), EMOJI)).length;
  assert.equal(short, long, 'the query must not be interpolated per emoji');
});
