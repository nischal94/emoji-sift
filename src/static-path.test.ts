import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStaticPath } from './static-path.ts';

const ROOT = '/srv/app/web/';

function status(pathname: string): number | undefined {
  const result = resolveStaticPath(pathname, ROOT);
  return 'status' in result ? result.status : undefined;
}

function resolved(pathname: string): string | undefined {
  const result = resolveStaticPath(pathname, ROOT);
  return 'path' in result ? result.path : undefined;
}

test('the root serves index.html', () => {
  assert.equal(resolved('/'), `${ROOT}index.html`);
});

test('a normal asset resolves inside the root', () => {
  assert.equal(resolved('/app.js'), `${ROOT}app.js`);
});

test('plain traversal is refused', () => {
  for (const attack of ['/../.env', '/../../.env', '/./../../.env', '/..//../.env']) {
    assert.equal(status(attack), 403, attack);
  }
});

test('percent-encoded traversal is refused, not a server error', () => {
  // The defect: these throw inside fileURLToPath, and with the throw outside
  // the try block they reached the 500 handler — a client error reported as a
  // server fault, with a stack trace logged for each one.
  for (const attack of ['/%2e%2e%2f.env', '/..%2f.env']) {
    assert.equal(status(attack), 400, attack);
  }
});

test('a sibling directory sharing the prefix is refused', () => {
  // Only holds because rootDir ends with a separator: '/srv/app/web-evil/x'
  // starts with '/srv/app/web'.
  assert.equal(status('/../web-evil/x'), 403);
});

test('a path that stays inside is allowed even when it looks odd', () => {
  // Resolves within the root, so it is allowed here and 404s at readFile.
  assert.equal(resolved('/....//.env'), `${ROOT}....//.env`);
});

test('an absolute path in the request does not escape', () => {
  assert.equal(status('//etc/passwd'), 403);
});
