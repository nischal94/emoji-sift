import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { abortOnDisconnect } from './disconnect.ts';

/**
 * These run a real server and a real client. The defect they exist against was
 * invisible to a unit test: `req.on('close')` looks correct on the page, and
 * only a client that actually hangs up mid-request shows that it never fires
 * once the body has been read.
 */

type Outcome = {
  /** Did the evaluator's signal fire while the slow work was running? */
  abortedDuringWork: boolean;
  /** Did the handler finish without the signal firing? */
  completed: boolean;
};

/**
 * Stand up a server whose handler reads the body, then does slow work while
 * watching for a disconnect — the shape of `handleSift`.
 */
function withServer(
  workMs: number,
  run: (port: number) => Promise<void>,
): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    const outcome: Outcome = { abortedDuringWork: false, completed: false };

    const handler = async (req: IncomingMessage, res: ServerResponse) => {
      // Consume the body first, exactly as readBody() does. This is what makes
      // a listener attached to `req` afterwards useless.
      for await (const _chunk of req) {
        // discarded; the body's content is irrelevant here
      }

      const disconnected = abortOnDisconnect(req, res);

      await new Promise((r) => setTimeout(r, workMs));

      if (disconnected.signal.aborted) {
        outcome.abortedDuringWork = true;
      } else {
        outcome.completed = true;
      }

      if (!res.writableEnded) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      }
    };

    const server: Server = createServer((req, res) => {
      void handler(req, res).catch((error: unknown) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      run(port)
        .then(() => new Promise((r) => setTimeout(r, workMs + 150)))
        .then(() => {
          server.close(() => resolve(outcome));
        })
        .catch((error: unknown) => {
          server.close(() => {
            reject(error instanceof Error ? error : new Error(String(error)));
          });
        });
    });
  });
}

test('a cancelled fetch aborts the work in flight', async () => {
  // The defect: with `req.on('close')` this stayed false, so a superseded
  // keystroke still billed a full 101-question evaluation.
  const outcome = await withServer(600, async (port) => {
    const controller = new AbortController();
    const request = fetch(`http://127.0.0.1:${port}/api/sift`, {
      method: 'POST',
      body: JSON.stringify({ query: 'things you can wear' }),
      signal: controller.signal,
    }).catch(() => undefined);

    setTimeout(() => controller.abort(), 150);
    await request;
  });

  assert.equal(outcome.abortedDuringWork, true, 'the evaluator signal must fire');
  assert.equal(outcome.completed, false);
});

test('a client that waits is not treated as a disconnect', async () => {
  // The inverse: aborting on every close would cancel requests that are fine.
  const outcome = await withServer(150, async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/sift`, {
      method: 'POST',
      body: JSON.stringify({ query: 'things you can wear' }),
    });
    await response.text();
    assert.equal(response.status, 200);
  });

  assert.equal(outcome.completed, true, 'a served request must not look aborted');
  assert.equal(outcome.abortedDuringWork, false);
});
