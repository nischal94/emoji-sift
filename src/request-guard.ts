/**
 * Checks that a POST to the model endpoint came from this page, not from
 * another site running in a visitor's browser.
 *
 * Serving the page from the same origin means the app's own fetch is
 * same-origin and needs no CORS headers. That is NOT a boundary on its own: a
 * cross-origin POST carrying `text/plain` is a "simple request", which the
 * browser sends without a preflight. The attacker cannot read the reply, but
 * the request arrives and the model call bills all the same.
 *
 * Two checks close that:
 *
 * 1. `Content-Type: application/json` is not on the simple-request list, so
 *    requiring it forces a preflight that CORS then blocks — this is the
 *    load-bearing half, and it holds even against an Origin nobody predicted.
 * 2. A present `Origin` must match the host being served. Browsers set it on
 *    every cross-origin request and on same-origin POSTs; it is absent for
 *    same-origin GETs and for non-browser clients such as curl, which have no
 *    ambient credentials to abuse and are not what this guards against.
 */

export type GuardFailure = {
  status: number;
  error: string;
};

/** Media type of the body, without parameters such as charset. */
function mediaType(header: string | undefined): string {
  return (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

/**
 * Returns null when the request may proceed, or the response to send instead.
 *
 * `host` is the Host header of this request: comparing against it rather than
 * a configured origin keeps the check correct behind a proxy or on any port,
 * without a setting to get wrong.
 */
export function checkSiftRequest(headers: {
  'content-type'?: string | undefined;
  origin?: string | undefined;
  host?: string | undefined;
}): GuardFailure | null {
  if (mediaType(headers['content-type']) !== 'application/json') {
    return {
      status: 415,
      error: 'Content-Type must be application/json.',
    };
  }

  const origin = headers.origin;
  if (origin !== undefined && origin !== 'null') {
    const host = headers.host;
    if (host === undefined) {
      return { status: 403, error: 'Cross-origin requests are not accepted.' };
    }

    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      // An Origin that is not a URL is not one a browser sent.
      return { status: 403, error: 'Cross-origin requests are not accepted.' };
    }

    if (originHost !== host) {
      return { status: 403, error: 'Cross-origin requests are not accepted.' };
    }
  }

  return null;
}
