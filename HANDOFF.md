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
head `8eb70cf` on `main`.

**Pushing to `main` is blocked by a global hook.** A push needs
`ALLOW_MAIN_PUSH=1 git push` run by the user; the agent commits but never
pushes (`.claude/settings.json` denies it).

| Layer | State |
| --- | --- |
| Jev integration | Working. 101 score questions in one request, ~14,780 tokens |
| Ranking | Pure, tested. Floor 1.5, limit 12, tie-break on pile order |
| Server | Node http, key server-side, loopback only, 4 concurrent max |
| UI | Input, row, pile. Fly-up and fall-back both land at 0px error |
| Acceptance set | 10 queries. Last run **8 passed / 0 failed / 2 unavailable** |
| Tests | 43 passing. Typecheck and lint clean |
| CI | **Green.** `.github/workflows/ci.yml`, ~45s on `ubuntu-latest`, no warnings |

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
  flag. All three call `requireGatewayKey()` from `src/env.ts`, so
  `node src/cli.mts` and `pnpm run sift` behave identically.
- **Jev is unreliable right now.** Single provider, no fallback,
  `fallbacksAvailable: []`. Two benches on 2026-09-22 lost 4 of 10 and then 2
  of 10 queries to 503s, each after 6 attempts. Response times across both:
  1.3s to **68s** for identical work, with several at ~35s. The browser
  retries 4 times; the CLI retries once on purpose so failures stay visible.
  Promotional free pricing ends 2026-09-25, after which load should drop.
- **An agent cannot run `pnpm run bench`.** It needs the key in `.env`, which
  the sandbox denies reading. A person runs it and pastes the output.
- **An agent CAN read CI itself** through the built-in browser at
  `github.com/nischal94/emoji-sift/actions` — the repo is public, so no
  credential is involved. `gh` is blocked (its config holds the token) but
  that blocks the CLI, not the information. See LEARNINGS for the full list of
  what needs handing over and what does not.

## What's DONE

- Jev integration, proven on nine query shapes
- Score-based ranking (replaced boolean; see LEARNINGS)
- Query normalization: length cap, control/format characters, quote handling
- Server with the key held server-side, body cap, concurrency cap, abort
  plumbed through so a cancelled keystroke stops the upstream call
- Fly-up and fall-back animation, both verified at 0px landing error
- 43 tests, each written against a defect that actually occurred
- Acceptance set with `must` / `mustNot` / `outranks`
- Two audits and one external review, all findings closed
- CI on push and PR, verified green on a clean runner

## What's LEFT

### 1. Sweep the acceptance set for other unasserted puns

Closed the 🔑 question and found the real defect underneath it. The original
report had it backwards: 🔑 stays **out** of "start a band" (0.88, below the
1.5 floor) and **in** "instruments you could play in a band", where it ranked
last of seven.

The query's note already said a pun with no valid reading there "would be a
real failure", but `mustNot` listed only `rock`, `pizza`, `hammer`. The check
could not go red on 🔑 because nobody encoded it. Fixed by `outranks: ['key']`,
matching the 🪨 precedent — a key is a tonal centre, which is band vocabulary
but not an instrument you could play.

**What is left:** the same gap may exist elsewhere. Read each query's `note`
and confirm every claim it makes is encoded in `must` / `mustNot` /
`outranks`. A note that describes a standard the assertions do not enforce is
the defect to look for.

### 2. `ubuntu-latest` migrates to Ubuntu 26 from 2026-10-19

A dated watch item, not a task: the build is version-agnostic and the only
annotation left on a green run is this notice. If CI breaks after that date,
pin `runs-on: ubuntu-24.04` and investigate from a working build.

The Node 20 deprecation that sat here is fixed. `actions/checkout@v7`,
`actions/setup-node@v7` and `pnpm/action-setup@v6` as of `8eb70cf`, verified
by the warning disappearing from run #4, not by the run merely passing.

### 3. Deployment, if it ever goes public

The server is loopback-only and has no auth or rate limiting beyond a
concurrency cap. Before exposing it: per-IP limits, and decide whether
idle-fire (1200ms) is affordable once Jev is paid.

The 68s response measured on 2026-09-22 matters here: four browser retries
behind a response that slow is far past any reasonable wait.

## Kickoff prompt for the next session

> Read HANDOFF.md and LEARNINGS.md in ~/projects/emoji-sift. Run `pnpm run
> check` to confirm the tree is green, then `pnpm run bench` to see where the
> model stands today. The next task is <pick one from What's LEFT>.
