# Handoff — emoji-sift

The baton between sessions.

1. **Session start:** read this file first, then whatever it points to. Do not
   re-derive state from scratch.
2. **Session end:** rewrite this file to match reality — repo state, next task,
   kickoff prompt. Do it LAST, after the final commit, so it is current.
3. This file *points*; git history is the archive.

**Staleness tripwire — run this before trusting anything below:**

```bash
git log -1 --format=%h                  # latest commit on this branch
git log -1 --format=%h -- HANDOFF.md    # latest commit that touched this file
```

If they differ, work happened after this handoff was written and it is stale by
exactly the commits between them. Reconstruct from `git log` over that range,
rewrite this file first, then proceed.

**Done-check** before saying "done" or "pushed": `git status --porcelain` clean,
`git status -sb` shows local == remote.

---

## What this is

A rebuild of [Stefan's Jev demo](https://x.com/heystefan_/status/2101369117496521042):
type a description, the matching emoji fly out of a pile into a row. The model
doing the judging is `typesafe-ai/jev` through Vercel AI Gateway.

## Current state (2026-09-22)

Working end to end. Public at https://github.com/nischal94/emoji-sift,
first commit `336ec0c` on `main`.

**Pushing to `main` is blocked by a global hook.** A push needs
`ALLOW_MAIN_PUSH=1 git push` run by the user; the agent commits but never
pushes (`.claude/settings.json` denies it).

| Layer | State |
| --- | --- |
| Jev integration | Working. 101 score questions in one request, ~14,780 tokens |
| Ranking | Pure, tested. Floor 1.5, limit 12, tie-break on pile order |
| Server | Node http, key server-side, loopback only, 4 concurrent max |
| UI | Input, row, pile. Fly-up animation lands exactly on target |
| Acceptance set | 10 queries, **9 passed / 0 failed / 1 unavailable** |
| Tests | 38 passing. Typecheck and lint clean |
| CI | **Not set up** — `.github/workflows/ci.yml` still to be created |

### How to run it

```bash
pnpm install
echo 'AI_GATEWAY_API_KEY=your_key' > .env   # once
pnpm run dev                                 # http://127.0.0.1:5174
```

```bash
pnpm run check   # typecheck + lint + tests — no network
pnpm run bench   # the acceptance set against live Jev
pnpm run sift "things you can wear"
```

### Environment gotchas

- **Node 22.18+.** Types are stripped, not compiled, so imports name the real
  file on disk (`./emoji.ts`, never `./emoji.js`).
- **`.env` is loaded by the entry points themselves**, not by a package.json
  flag. `node src/cli.mts` and `pnpm run sift` behave identically.
- **Jev is unreliable right now.** Single provider, no fallback,
  `fallbacksAvailable: []`. Measured: success, 503, success, 503 on identical
  input, and response times from 1.1s to 35s for the same work. The browser
  retries 4 times; the CLI retries once on purpose so failures stay visible.
  Promotional free pricing ends 2026-09-25, after which load should drop.

## What's DONE

- Jev integration, proven on nine query shapes
- Score-based ranking (replaced boolean; see LEARNINGS)
- Query normalization: length cap, control/format characters, quote handling
- Server with the key held server-side, body cap, concurrency cap, abort
  plumbed through so a cancelled keystroke stops the upstream call
- Fly-up animation, verified to land within 0px of its target
- 38 tests, each written against a defect that actually occurred
- Acceptance set with `must` / `mustNot` / `outranks`
- Two audits and one external review, all findings closed

## What's LEFT

### 1. CI

`.github/workflows/ci.yml` — typecheck, lint, test on push and PR. No
`AI_GATEWAY_API_KEY` in CI: the tests are pure, and model behaviour belongs in
`pnpm run bench`, which a person runs and reads.

### 2. The fall-back animation

Built but never watched. Clearing the input should return every lifted emoji to
its pile position.

### 3. 🔑 key in both band queries

Scores above the floor for "start a band" and "instruments you could play in a
band" — a musical-key pun, same shape as 🪨 rock. Not a failure; add to
`outranks` if it looks wrong in the UI.

### 4. Deployment, if it ever goes public

The server is loopback-only and has no auth or rate limiting beyond a
concurrency cap. Before exposing it: per-IP limits, and decide whether
idle-fire (1200ms) is affordable once Jev is paid.

## Kickoff prompt for the next session

> Read HANDOFF.md and LEARNINGS.md in ~/projects/emoji-sift. Run `pnpm run
> check` to confirm the tree is green, then `pnpm run bench` to see where the
> model stands today. The next task is <pick one from What's LEFT>.
