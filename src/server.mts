import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EMOJI } from './emoji.ts';
import {
  sift,
  InvalidQueryError,
  MAX_QUERY_LENGTH,
  RETRIES_INTERACTIVE,
  normalizeQuery,
} from './sift.ts';
import { ResultCache } from './result-cache.ts';

import { abortOnDisconnect } from './disconnect.ts';
import { checkSiftRequest } from './request-guard.ts';
import { resolveStaticPath } from './static-path.ts';
import { requireGatewayKey } from './env.ts';

requireGatewayKey();

const PORT = Number(process.env.PORT ?? 5174);
const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url));

/** Cap on one request body. The query itself is capped separately. */
const MAX_BODY_BYTES = 4 * 1024;

/**
 * Evaluations allowed to be in flight at once.
 *
 * A 4 KB post fans out to 101 questions and a ~145 KB upstream request, so
 * the body cap alone does not bound what this endpoint can spend. Without a
 * limit, a loop of concurrent posts multiplies both cost and the 503s that
 * a single-provider model already returns under load.
 */
const MAX_CONCURRENT_SIFTS = 4;
let inFlight = 0;

/**
 * Answers already paid for, keyed on the normalized query.
 *
 * Shared by every client of this process, so a warmed query is instant in any
 * browser and survives a page reload — unlike the per-tab `Map` in
 * `web/app.js`, which dies with the page. It also removes the repeat spend:
 * the same query never bills a second evaluation while the server is up.
 */
const resultCache = new ResultCache();

/**
 * The key stays here and never reaches the browser: the page posts a query
 * and gets back the ranked row.
 *
 * Same-origin serving means the app's own fetch needs no CORS headers. It does
 * NOT stop another site from spending the key — a cross-origin `text/plain`
 * POST is a simple request and is sent without a preflight, so the attacker
 * cannot read the reply but the model call still bills. `checkSiftRequest`
 * is what closes that; see `request-guard.ts`.
 *
 * Still missing for a public deployment: per-IP rate limiting and a spending
 * ceiling. The concurrency cap below is global, so it bounds simultaneous
 * cost, not total cost.
 */
const server = createServer((req, res) => {
  void handle(req, res).catch((error: unknown) => {
    console.error('[emoji-sift] Unhandled request error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal error.' }));
    }
  });
});

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/emoji') {
    return json(res, 200, { emoji: EMOJI });
  }

  if (req.method === 'POST' && url.pathname === '/api/sift') {
    return await handleSift(req, res);
  }

  if (req.method === 'GET') {
    return await serveStatic(url.pathname, res);
  }

  json(res, 405, { error: 'Method not allowed.' });
}

async function handleSift(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Before the body is read, so a request from another site costs nothing.
  const refusal = checkSiftRequest(req.headers);
  if (refusal) {
    return json(res, refusal.status, { error: refusal.error });
  }

  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    return json(res, 413, { error: 'Request body too large.' });
  }

  let query: unknown;
  try {
    query = (JSON.parse(raw) as { query?: unknown }).query;
  } catch {
    return json(res, 400, { error: 'Body must be JSON.' });
  }

  if (typeof query !== 'string') {
    return json(res, 400, { error: 'Expected a "query" string.' });
  }

  // `normalizeQuery` throws on an empty or over-long query, and `sift` calls
  // it again inside the try block below where that throw becomes a 400. Here
  // it is outside any handler, so an unguarded call would turn a client error
  // into a 500 — the same shape as the static-path defect fixed earlier.
  let cacheKey: string;
  try {
    cacheKey = normalizeQuery(query);
  } catch (error) {
    if (error instanceof InvalidQueryError) {
      return json(res, 400, { error: error.message });
    }
    throw error;
  }

  // Before the concurrency check on purpose: an answer already in memory
  // costs nothing to serve, so refusing it under load would be perverse.
  const cached = resultCache.get(cacheKey);
  if (cached) {
    return json(res, 200, cached);
  }

  if (inFlight >= MAX_CONCURRENT_SIFTS) {
    res.setHeader('retry-after', '1');
    return json(res, 429, { error: 'Too many requests in flight. Try again.' });
  }

  const disconnected = abortOnDisconnect(req, res);

  inFlight++;
  try {
    // Someone is watching this one, so absorb the transient 503s rather than
    // showing an error the next attempt would have cleared.
    //
    // The timeout covers the whole retry chain, not one attempt, so it has to
    // be long enough to contain it: five attempts with exponential backoff
    // plus a slow response runs well past fifteen seconds, and a shorter
    // deadline would cancel the retries before they could help.
    const { matches, ms } = await sift(query, {
      timeoutMs: 45_000,
      signal: disconnected.signal,
      maxRetries: RETRIES_INTERACTIVE,
    });
    if (disconnected.signal.aborted) return;
    const body = {
      matches: matches.map((m) => ({ id: m.emoji.id, char: m.emoji.char, score: m.score })),
      ms,
    };
    // Stored only on a completed evaluation: a cancelled or failed one has
    // nothing worth keeping, and caching a partial answer would serve it for
    // the life of the process.
    resultCache.set(cacheKey, body);
    json(res, 200, body);
  } catch (error) {
    if (error instanceof InvalidQueryError) {
      return json(res, 400, { error: error.message });
    }
    // A client that hung up is not an error worth logging or answering.
    if (disconnected.signal.aborted) return;

    // Jev has one provider and no fallback, so an unavailable model is a
    // routine event, not a defect in this server. Log it as one line: the
    // SDK's error carries three nested stack traces, and printing them for
    // every failed keystroke buries anything that is a real bug.
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.error(`[emoji-sift] model unavailable: ${detail}`);
    json(res, 503, { error: 'The model is unavailable right now. Try again.' });
  } finally {
    inFlight--;
  }
}

function readBody(
  req: IncomingMessage,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

async function serveStatic(
  pathname: string,
  res: ServerResponse,
): Promise<void> {
  const target = resolveStaticPath(pathname, WEB_DIR);
  if ('status' in target) {
    return json(res, target.status, {
      error: target.status === 400 ? 'Bad path.' : 'Forbidden.',
    });
  }
  const filePath = target.path;

  try {
    const body = await readFile(filePath);
    const ext = filePath.slice(filePath.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    json(res, 404, { error: 'Not found.' });
  }
}

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// Bound to the loopback address explicitly: this holds a gateway key and has
// no authentication, so it should not be reachable from the local network.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  emoji-sift — http://127.0.0.1:${PORT}`);
  console.log(`  ${EMOJI.length} emoji · queries up to ${MAX_QUERY_LENGTH} chars\n`);
});
