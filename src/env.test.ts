import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `requireGatewayKey` ends in `process.exit`, so it cannot be called in this
// process without taking the test runner down with it. Each case runs a real
// node in a temp project, which is also the only way to exercise the file
// states the function exists to tell apart.

const ENV_SOURCE = fileURLToPath(new URL('./env.ts', import.meta.url));

interface Run {
  status: number;
  stderr: string;
  stdout: string;
}

/**
 * Build a throwaway project whose `src/` holds a copy of env.ts, put `.env`
 * into the requested state, and run a script that calls requireGatewayKey.
 */
function runWith(envState: 'absent' | 'readable' | 'unreadable', keyInEnvironment?: string): Run {
  const root = mkdtempSync(join(tmpdir(), 'emoji-sift-env-'));
  const envPath = join(root, '.env');
  try {
    mkdirSync(join(root, 'src'));
    copyFileSync(ENV_SOURCE, join(root, 'src', 'env.ts'));
    writeFileSync(
      join(root, 'src', 'probe.mts'),
      "import { requireGatewayKey } from './env.ts';\n" +
        'requireGatewayKey();\n' +
        "console.log('OK:' + process.env.AI_GATEWAY_API_KEY);\n",
    );

    if (envState !== 'absent') {
      writeFileSync(envPath, 'AI_GATEWAY_API_KEY=from_file\n');
      if (envState === 'unreadable') chmodSync(envPath, 0o000);
    }

    // Start from a clean environment so the developer's own key cannot make a
    // "missing credential" case pass.
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.AI_GATEWAY_API_KEY;
    if (keyInEnvironment !== undefined) env.AI_GATEWAY_API_KEY = keyInEnvironment;

    try {
      const stdout = execFileSync(process.execPath, ['probe.mts'], {
        cwd: join(root, 'src'),
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { status: 0, stdout, stderr: '' };
    } catch (error) {
      const e = error as { status?: number; stdout?: string; stderr?: string };
      return { status: e.status ?? -1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
    }
  } finally {
    // chmod back first, or removing the unreadable case fails on some systems.
    try {
      chmodSync(envPath, 0o644);
    } catch {
      // Absent in the 'absent' case; nothing to restore.
    }
    rmSync(root, { recursive: true, force: true });
  }
}

test('loads the key from a readable .env', () => {
  const run = runWith('readable');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /OK:from_file/);
});

test('an absent .env is fine when the key is in the environment', () => {
  const run = runWith('absent', 'from_environment');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /OK:from_environment/);
});

test('an absent .env with no key reports a missing credential', () => {
  const run = runWith('absent');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Missing credential/);
});

test('an unreadable .env is not reported as a missing credential', () => {
  // The defect this guards: `loadEnvFile` reports an unreadable file as
  // ENOENT, identically to an absent one, so the old code sent the reader off
  // to create a file that was already sitting there.
  const run = runWith('unreadable');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /cannot read it/);
  assert.doesNotMatch(run.stderr, /Missing credential/);
});

test('the unreadable message names the path but never the contents', () => {
  const run = runWith('unreadable');
  assert.match(run.stderr, /\.env/);
  assert.doesNotMatch(run.stderr, /from_file/);
});
