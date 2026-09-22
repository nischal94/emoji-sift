import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSiftRequest } from './request-guard.ts';

const HOST = '127.0.0.1:5174';

test('the page\'s own request passes', () => {
  assert.equal(
    checkSiftRequest({
      'content-type': 'application/json',
      origin: `http://${HOST}`,
      host: HOST,
    }),
    null,
  );
});

test('a charset parameter does not change the media type', () => {
  assert.equal(
    checkSiftRequest({ 'content-type': 'application/json; charset=utf-8', host: HOST }),
    null,
  );
});

test('a request with no Origin passes', () => {
  // curl and other non-browser clients send none, and they carry no ambient
  // credentials for another site to abuse.
  assert.equal(checkSiftRequest({ 'content-type': 'application/json', host: HOST }), null);
});

test('the cross-origin simple request is refused', () => {
  // The actual attack: text/plain is a simple-request content type, so the
  // browser sends it with no preflight and the model call would bill.
  const failure = checkSiftRequest({
    'content-type': 'text/plain;charset=UTF-8',
    origin: 'https://evil.example',
    host: HOST,
  });
  assert.equal(failure?.status, 415);
});

test('a missing Content-Type is refused', () => {
  assert.equal(checkSiftRequest({ origin: `http://${HOST}`, host: HOST })?.status, 415);
});

test('form encoding is refused', () => {
  // The other simple-request content types.
  for (const type of ['application/x-www-form-urlencoded', 'multipart/form-data']) {
    assert.equal(checkSiftRequest({ 'content-type': type, host: HOST })?.status, 415);
  }
});

test('a foreign Origin is refused even with the right Content-Type', () => {
  // Defence in depth: this case cannot reach a browser, because the
  // Content-Type forces a preflight CORS blocks. It holds for anything that
  // sets Origin by hand.
  const failure = checkSiftRequest({
    'content-type': 'application/json',
    origin: 'https://evil.example',
    host: HOST,
  });
  assert.equal(failure?.status, 403);
});

test('an Origin on a different port is refused', () => {
  // Same host, different port is a different origin.
  const failure = checkSiftRequest({
    'content-type': 'application/json',
    origin: 'http://127.0.0.1:9999',
    host: HOST,
  });
  assert.equal(failure?.status, 403);
});

test('a malformed Origin is refused', () => {
  assert.equal(
    checkSiftRequest({ 'content-type': 'application/json', origin: 'not a url', host: HOST })
      ?.status,
    403,
  );
});

test('an opaque Origin passes the origin check', () => {
  // A sandboxed iframe or a redirected request sends "null". It is not a
  // foreign host, and the Content-Type requirement already governs it.
  assert.equal(
    checkSiftRequest({ 'content-type': 'application/json', origin: 'null', host: HOST }),
    null,
  );
});
