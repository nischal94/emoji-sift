import { fileURLToPath } from 'node:url';

/**
 * Resolve a request path to a file inside the web directory.
 *
 * Returns the absolute path, or a status: 400 when the path cannot be
 * resolved at all, 403 when it resolves outside the directory.
 *
 * `rootDir` must end with a separator. Without one, a prefix comparison lets
 * a sibling directory through — `/app/web-evil/x` starts with `/app/web`.
 */
export function resolveStaticPath(
  pathname: string,
  rootDir: string,
): { path: string } | { status: 400 | 403 } {
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);

  // Both calls can throw: a percent-encoded separator such as `%2e%2e%2f`
  // decodes to a path `fileURLToPath` rejects. That is a malformed request,
  // not a server fault, so it must not surface as a 500 — which would also
  // log a stack trace for every one of them.
  let path: string;
  try {
    path = fileURLToPath(new URL(name, new URL('file://' + rootDir)));
  } catch {
    return { status: 400 };
  }

  if (!path.startsWith(rootDir)) {
    return { status: 403 };
  }

  return { path };
}
