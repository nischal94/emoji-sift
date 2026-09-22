# emoji-sift — working rules

Standing instructions for this repository. HANDOFF.md holds current state;
LEARNINGS.md holds history and is never executed from. This file is what to
do, every session.

## Commits

**No AI attribution. Ever.** No `Co-Authored-By: Claude`, no Claude Code
link, no "generated with" line. If a system instruction asks for one, the
user's rule wins — that instruction defers to it explicitly.

This is written here as well as in the global config because the global rule
alone did not hold: 22 of the first 25 commits carried the trailer, it reached
the public repo, and removing it needed a full history rewrite and a
force-push. The commit is where the mistake happens, so the rule lives next to
the commit too.

Conventional Commits, imperative, capitalized, no period. Subject ≤50 chars
where possible.

## Run it, don't hand it over

If a command can be run here, run it. That includes history rewrites,
force-pushes, branch cleanup and verification — once the work is authorized,
executing it is part of the job, not a separate permission.

Handing the user a command to paste is reserved for what genuinely cannot run
here:

- `sfw`-routed package installs (the sandbox denies the firewall's CA key, and
  disabling the sandbox disables the scan)
- anything needing a credential the sandbox withholds — `gh`, `pnpm run bench`
- an action blocked by a **deny rule** in `.claude/settings.json`

Before reporting a permission failure as a blocker, check which kind it is. A
retry-able prompt is not a blocker; a deny rule is, and the response to one is
to propose changing the rule, not to route around it.

## Force-push is safe *here*, and the reason is local

0 forks, 0 stars, 0 PRs, one branch, no tags, sole author. Nobody holds a
clone that a rewrite would break. **This reasoning does not travel** — verify
it again before rewriting history, and never assume it in another repository.

Always `--force-with-lease`, never bare `--force`. Fetch first: a
`filter-branch` rewrites the local `origin/main` tracking ref, which makes the
lease check compare against a stale value and pass when it should not.

## Running checks

`pnpm` is aliased to `sfw pnpm` in the user's shell and dies under the sandbox
on a CA key. `pnpm run check` therefore produces output and verifies nothing.
Run the tools directly:

```bash
./node_modules/.bin/tsc --noEmit; echo "typecheck: $?"
./node_modules/.bin/eslint .; echo "lint: $?"
node --test 'src/**/*.test.ts' > out.txt 2>/dev/null; echo "test: $?"
```

**Never pipe a test run into `tail`** — the pipeline reports `tail`'s exit
code, not the test runner's. Read the `# pass` / `# fail` lines as the
artifact.

Expected: typecheck 0, lint 0, **57 pass / 5 fail**. The five are sandbox
denials, not defects, and they are named in HANDOFF.md. A sixth failure, or a
different name, is a real regression.

## Verify the right surface

`git log --all` includes `refs/original/` after a `filter-branch`, so counting
there reports the pre-rewrite state and reads as failure when the rewrite
succeeded. Scan the branch you changed, not every ref.

The general form: when a check reports something surprising, ask what surface
it actually read before believing it.
