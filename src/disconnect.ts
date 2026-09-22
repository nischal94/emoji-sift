import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * An AbortSignal that fires when the client goes away before it is answered.
 *
 * The browser aborts its fetch on every new keystroke batch. Without this, the
 * disconnect is invisible to the handler and the 101-question evaluation runs
 * to completion and bills, for a result nobody will read.
 *
 * Listen on the RESPONSE, not the request. By the time a handler has read the
 * body, `IncomingMessage` is already complete and its own `close` has fired —
 * a listener attached afterwards never runs, so a cancelled fetch looks
 * identical to a waiting one. `res.on('close')` fires on both outcomes, so
 * `writableEnded` is what separates them: false means the connection dropped
 * before the answer was written.
 */
export function abortOnDisconnect(
  req: Pick<IncomingMessage, 'socket'>,
  res: ServerResponse,
): AbortController {
  const controller = new AbortController();

  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };

  res.on('close', onClose);

  // Release the listener once the answer is out, so a keep-alive connection
  // does not accumulate one per request.
  res.on('finish', () => res.off('close', onClose));

  return controller;
}
