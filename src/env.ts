import { accessSync, constants } from 'node:fs';
import { loadEnvFile } from 'node:process';

/**
 * Load `.env` from the project root and check the credential it must carry.
 *
 * Every entry point calls this itself rather than relying on a flag in
 * package.json, so `node src/cli.mts` behaves the same as `pnpm run sift`.
 */
export function requireGatewayKey(): void {
  const envPath = new URL('../.env', import.meta.url);

  // `loadEnvFile` reports an unreadable file as ENOENT, exactly like an absent
  // one, so its error cannot tell "no .env" from "a .env nobody may read".
  // Probing first is what separates them: a missing file is normal, and the
  // key may come from the real environment instead, but a file that exists
  // and cannot be read is a problem worth naming rather than reporting as a
  // missing credential.
  let present = true;
  try {
    accessSync(envPath, constants.F_OK);
  } catch {
    present = false;
  }

  if (present) {
    try {
      accessSync(envPath, constants.R_OK);
    } catch {
      console.error(`[emoji-sift] Found .env but cannot read it: ${envPathLabel(envPath)}`);
      console.error('             Check its permissions, or unset it and use the environment.');
      process.exit(1);
    }

    try {
      loadEnvFile(envPath);
    } catch (error) {
      console.error(`[emoji-sift] Failed to load .env: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('[emoji-sift] Missing credential: AI_GATEWAY_API_KEY is not set.');
    console.error('             Create a .env file in the project root containing:');
    console.error('               AI_GATEWAY_API_KEY=<your key>');
    process.exit(1);
  }
}

/** The path only — never the contents, which are the credential. */
function envPathLabel(url: URL): string {
  return decodeURIComponent(url.pathname);
}
