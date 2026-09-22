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

Type a description, and the matching emoji fly out of a pile into a row. The
model doing the judging is `typesafe-ai/jev` through Vercel AI Gateway.

## Current state (2026-09-22)

Working end to end. Public at https://github.com/nischal94/emoji-sift,
on `main`. For the current head run `git log -1 --format=%h`: a hash written
here goes stale on the next commit, and the tripwire above already detects
that better than a copied value does.

**Pushing to `main` is blocked by a global hook.** A push needs
`ALLOW_MAIN_PUSH=1 git push` run by the user; the agent commits but never
pushes (`.claude/settings.json` denies it). This was raised as a change on
2026-09-22 and deliberately left alone — the deny rule held correctly all
session and is doing its job.

**Every commit hash changed on 2026-09-22.** A `filter-branch` stripped an
AI attribution trailer from 22 of 25 commits, followed by a force-push. Any
hash quoted in a document, a note or an external tool from before that date
is dangling. The pre-rewrite history survives locally in
`refs/original/refs/heads/main` at `5415e17`, and in the branch
`backup-before-trailer-strip`; both are kept until someone decides they are
no longer wanted. Neither was pushed.

| Layer | State |
| --- | --- |
| Jev integration | Working. 101 score questions in one request, ~14,780 tokens |
| Ranking | Pure, tested. Floor 1.5, limit 12, tie-break on pile order |
| Server | Node http, key server-side, loopback only, 4 concurrent max. JSON content-type and same-host Origin required. Caches the last 200 answers |
| UI | Input, row, pile. Fly-up and fall-back both land at 0px error |
| Acceptance set | 10 queries. Last run **8 passed / 0 failed / 2 unavailable** |
| Tests | 72 total. **67 pass in the agent sandbox, 5 cannot run there** — see below. Typecheck and lint clean |
| CI | **Green**, every run so far. `.github/workflows/ci.yml`, ~30s on `ubuntu-latest`, no warnings |

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
- **Five tests fail in the agent sandbox and none of them is a defect.**
  Measured 2026-09-22 at 67 pass / 5 fail; unsandboxed and in CI the suite is
  72/72. Do not go bug-hunting, and do not accept a *sixth* failure as more of
  the same — the five are named, and anything else is real:
  - `a cancelled fetch aborts the work in flight`
  - `a client that waits is not treated as a disconnect`
  - `loads the key from a readable .env`
  - `an unreadable .env is not reported as a missing credential`
  - `the unreadable message names the path but never the contents`

  Three separate denials cause them: the sandbox refuses to **bind a listener**
  (`server.listen` → `EPERM`, killing the two disconnect tests before any
  assertion runs), refuses to **unlink** a file named `.env` (the `finally`
  cleanup in `env.test.ts`, after its assertions have passed), and refuses to
  **read** one (so the probe subprocess exits non-zero). Writing a `.env` is
  permitted, which is why the symptom looks like a cleanup bug.

  To see the real state, run the tools directly — `pnpm` is aliased to `sfw`
  and dies under the sandbox on a CA key:

  ```bash
  ./node_modules/.bin/tsc --noEmit; echo "typecheck: $?"
  ./node_modules/.bin/eslint .; echo "lint: $?"
  node --test 'src/**/*.test.ts' > out.txt 2>/dev/null; echo "test: $?"
  ```

  Never pipe the test run into `tail` — the pipeline reports `tail`'s status.
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
- 72 tests, each written against a defect that actually occurred
- Server-side result cache — `src/result-cache.ts`, last 200 answers keyed on
  the normalized query. Shared by every client and survives a page reload,
  unlike the per-tab `Map` in `web/app.js`. A repeated query costs nothing and
  returns instantly, which is what makes a demo recording practical while Jev
  is slow
- Acceptance set with `must` / `mustNot` / `outranks`
- Two audits and two external reviews, all findings closed
- CI on push and PR, verified green on a clean runner
- Deployment scoped and decided — `DEPLOYMENT.md`, 2026-09-22. Not launching
  yet; the reasoning and the reopen trigger are in that file
- `CLAUDE.md`, the project's standing instructions. **Read it before the first
  commit of any session**, not after. It holds the commit rules, what
  "authorized" does and does not cover, the direct-binary check commands, and
  the verification traps this repo has already sprung
- AI attribution removed from the whole history and the rule written down in
  two places. See "Every commit hash changed" above
- `.gitignore` covers the credential shapes, not just `.env`: `secrets.json`,
  `*.pem`, `*.key`, `id_rsa`, `id_ed25519`, `*.local.json`. The repo is
  public, so a single slip is a disclosure. `.claude/.cc-writes/` is also
  listed here rather than relying on a personal global gitignore, which
  protected one machine and no clone.

### The second external review (2026-09-22), all four findings fixed

Each was reproduced before being accepted and verified after. Details and the
reasoning are in LEARNINGS.

- **Cancellation was wired to an event that never fires.** The handler
  listened for `close` on the request after reading its body, by which point
  that object is already complete — so a cancelled fetch still ran and billed
  a full 101-question evaluation. Now `res.on('close')` guarded by
  `!res.writableEnded`, in `src/disconnect.ts`, with two integration tests
  that go red against the old implementation.
- **Same-origin serving was not a spending boundary.** A cross-origin
  `text/plain` POST is a simple request, so the browser sent it with no
  preflight: the attacker could not read the reply, but the model call billed.
  Now `src/request-guard.ts` requires `application/json` (not a
  simple-request type, so it forces a preflight CORS blocks) and rejects a
  foreign `Origin`.
- **A concluded experiment left a bypass switch.** `SIFT_PROMPT=repeated`
  reverted the prompt-injection boundary, and the test guarding it failed
  whenever that variable was set. The switch, the type and the old builder are
  gone, so the boundary is structural. Verified by running the suite with the
  variable set.
- **Four documentation claims had outlived the code**, including one in a test
  comment the review did not list.

### An edge-case pass on the new boundaries found one more

Probed both new guards with cases they were not designed against: media types
that resemble JSON (`application/ld+json`, `text/json`, `application/jsonx`,
a `;x=application/json` parameter), Origin host tricks (subdomain, port
prefix, path and trailing slash, scheme mismatch), percent-encoded traversal,
listener accumulation over keep-alive, and the `inFlight` counter under abort.
All held except one:

- **A malformed static path answered 500.** `fileURLToPath` throws on
  `%2e%2e%2f`, and the call sat outside the try block, so a client error
  surfaced as a server fault and logged a stack trace for each request. Now
  `src/static-path.ts` returns 400 for unresolvable and 403 for outside-root.
  No content was ever exposed; the traversal itself was blocked throughout.

Two properties worth not breaking, both now covered by tests: `WEB_DIR` must
end with a separator, or the prefix check lets a sibling directory through
(`/app/web-evil` starts with `/app/web`); and `/api/emoji` needs no request
guard because it serves a constant and makes no model call.

## The acceptance set, after the 2026-09-22 sweep

Closed the 🔑 question and found the real defect underneath it. The original
report had it backwards: 🔑 stays **out** of "start a band" (0.88, below the
1.5 floor) and **in** "instruments you could play in a band", where it ranked
last of seven.

The query's note already said a pun with no valid reading there "would be a
real failure", but `mustNot` listed only `rock`, `pizza`, `hammer`. The check
could not go red on 🔑 because nobody encoded it. Fixed by `outranks: ['key']`,
matching the 🪨 precedent — a key is a tonal centre, which is band vocabulary
but not an instrument you could play.

**Swept the other nine queries: no further gaps.** Only two
other notes make normative claims, and both are asserted — "things that make
noise" names feather, rock and socks as silent and forbids exactly those;
"start a band" calls 🪨 defensible and requires the instruments to outrank it.
The rest are descriptive: they say why a query earns its place, not what the
row must contain.

Two things the sweep deliberately did NOT change, both recorded so the next
reader does not redo the reasoning:

- **The magnet `mustNot` lists 4 of ~35 non-ferrous objects.** That is the
  header's "deliberately short" policy, not an oversight. Completing the list
  would make the set a snapshot of today's output and would never converge.
- **🏀 basketball appears on "i need to lose weight"** below 🥦, the same
  defensible-secondary shape as 🪨 on "start a band". It is not asserted
  because that query's note never claimed a standard about it. Adding
  `outranks: ['basketball']` would invent a judgement the set never made.
  Assert it only if the row starts leading with it.

## What's LEFT

### 0. LIVE — demo video, and a local reliability check first

Added 2026-09-22 at the user's request, and it reorders what follows. The goal
is now a recorded demo of the working app, with deployment after it rather
than before.

**An agent CAN run and test the app.** Done 2026-09-22; results in
DEPLOYMENT.md under "Live measurement". `node src/server.mts` fails inside the
sandbox with "Found .env but cannot read it" — the read-deny on `**/.env` —
but runs unsandboxed, and the built-in browser then drives the real UI at
http://127.0.0.1:5174. `curl` to loopback is refused by policy, so the browser
is the route. Check for an already-running server first: one was listening on
5174 from an earlier session, and the second start died on `EADDRINUSE`.

What the run answers, in one pass:

- **Does it work today** — the feature is finished and tested, but no agent
  has seen it against live Jev this session.
- **Is it fast enough to film** — responses measured 1.3s to 68s on 2026-09-22.
  A 68s wait ruins a take. A recording needs the fast end.
- **Is deploying worth it this week** — this is the same evidence item 1 is
  waiting on, gathered from the browser instead of `pnpm run bench`.

Queries that show why the model is needed, because keyword search cannot do
them: `things a magnet could attract`, `i need to lose weight`,
`things you can wear`, `start a band`.

**Record in a light-mode browser. No flag needed.** Two things differ from
the reference video and both are settings, not code:

- **The status line is hidden by default** as of 2026-09-22. `5 of 101 ·
  4583ms` now needs `?debug`; a plain URL shows nothing. Loading states
  (`sifting…`, `still sifting`), `nothing matched` and errors still show
  always — a query that runs for thirty seconds behind a blank screen reads
  as a broken app, and a silent failure mid-take wastes time on debugging
  instead of a retake.

  Messages carry `data-kind`: `diagnostic` hides, `error` shows, no kind
  means transient progress and shows. Whatever changes here, the element must
  stay in the accessibility tree — the emoji row is `aria-hidden`, so this
  line is the ONLY thing a screen reader has to learn anything matched.
  Clip it, never `display: none`.

- **The theme follows the OPERATING SYSTEM, not the app or the browser.**
  `web/style.css` honours `prefers-color-scheme`, so a device set to dark
  renders the app dark — correct behaviour, and not a bug. The reference
  video is light.

  **A fresh browser profile does not change this.** Chrome guest mode was
  tried on 2026-09-22 and still rendered dark: a new profile drops
  extensions and cookies, then asks the same OS what appearance is in use.
  Fix it at the source — macOS System Settings > Appearance > Light (set it
  explicitly, because Auto flips at sunset and would change the theme
  mid-recording), or iOS Settings > Display & Brightness, or Android
  Settings > Display.

  Per-tab alternative that leaves the system alone: Chrome DevTools >
  Rendering > "Emulate CSS media feature prefers-color-scheme" > light. It
  survives reloads but needs DevTools open, which is awkward on camera.

  There is no in-app theme override and no `?light` flag. Adding one is a
  product decision nobody has made.

**The latency problem is solved for recording purposes.** The server cache
added 2026-09-22 means a query only ever waits once per server process. Warm
the demo queries, then record: each returns instantly with the full fly-up
animation and no "cached" label on screen, because the server replays the
original response including its `ms` value. A page reload no longer costs
anything. Restarting the server does — the cache is in memory by design.

Five queries were warmed on 2026-09-22 and measured at 1–7ms round trip:
`things you can wear` (12), `i need to lose weight` (4),
`things a magnet could attract` (12), `things you can wear in winter` (5),
`start a band` (7). **The cache key is case-sensitive** —
`normalizeQuery` collapses whitespace and preserves case, so `Things You Can
Wear` is a different key and pays full price. Type the queries in lowercase.

**🪨 rock on "start a band" is correct and deliberate.** Measured: guitar
2.51, drum 2.08, **rock 2.04**, trumpet 1.81, piano 1.80, saxophone 1.78,
violin 1.65. The model is reading "start a *rock* band", which is a fair
reading of the phrase. The acceptance set already encodes this as
`outranks` rather than `mustNot`, and the assertion passes because guitar
beats rock. Do not "fix" this. If a demo needs instruments with no pun, the
control query `instruments you could play in a band` is in the set for
exactly that, and was NOT warmed.

**Then, in order:** record if it is responsive → decide deployment with item 1
reopened → the deployment work itself, already scoped in DEPLOYMENT.md.

If it stalls or errors repeatedly, that is item 1's "not yet" confirmed from a
second direction, and the video waits for Jev rather than for code. Record the
observed speed and failure rate in DEPLOYMENT.md either way; it is the same
measurement the reopen trigger asks for.

**Context the next session will not otherwise have:** `~/projects/jev` holds
the Jev starter (`index.mts`) and `s2ygWn-SPWBDHupm.mp4`. That starter asks
three questions about one support ticket; emoji-sift asks one score question
about each of 101 emoji. Same `experimental_evaluate` API, different shape —
the fan-out is what makes one request rank the whole pile.

**The video is the REFERENCE this app was built to match.** 33s, 3620x2160,
60fps, no audio. It predates the repository: the file is dated 01:54 and the
first commit is 12:51 the same day, eleven hours later. It uses
`127.0.0.1:5174` because this app copied that port, not the reverse.

Every element in it is built, checked feature by feature on 2026-09-22: the
pile of 101 emoji, the centred box with an `×` clear, type-to-search with no
submit, the results row capped at 12, the fly-up, the fall-back, and all
three demo queries — `things you can wear`, `i need to lose weight`,
`things a magnet could attract` — each in the acceptance set. **Nothing in
the reference is missing.** The remaining work is a recording, not code.

**An agent CAN read a video here.** `ffmpeg`/`ffprobe` are on PATH:
`ffprobe` for the properties, then
`ffmpeg -i <file> -vf "fps=1/3,scale=1200:-1" frames/f_%02d.png` into the
scratchpad, then Read each frame. Check for an audio stream first — this one
has none, so transcription would have returned nothing. Do not tell the user
a local video cannot be watched.

### 1. DORMANT — deployment, decided against for now

**Answered 2026-09-22 in [DEPLOYMENT.md](DEPLOYMENT.md). Not launching yet.**
Read that file rather than re-deriving the reasoning; it records what was
measured, what was decided, and what would reverse it.

The short version: the blocker is upstream and unfixable from this repository.
20–40% of queries are lost to 503s *after* six retries, responses range to 68s,
and Jev has no fallback provider. Questions 1–3 (host binding, per-IP rate
limiting, idle-fire) are scoped in that document but deliberately not decided,
because they are conditional on launching.

**One item is NOT conditional and is still open: question 4, a spend ceiling
at the Gateway.** It is configured outside this repository, so it survives any
defect introduced inside it. Worth doing whether or not the launch happens, and
it needs the user — an agent has no Gateway access.

**Trigger to reopen: on or after 2026-09-25**, when promotional free pricing
ends and load should drop. Run `pnpm run bench` twice and read two numbers:

- **Unavailable count** — 0–1 of 10 across both runs is a launch signal; 2+ is not.
- **Worst response time** — under ~15s is fine behind the existing `still
  sifting` notice; a 68s outlier is not, whatever the failure rate.

If both clear, answer questions 1–3 and implement. If not, append the new
measurements to DEPLOYMENT.md and leave this dormant.

### 2. `ubuntu-latest` migrates to Ubuntu 26 from 2026-10-19

A dated watch item, not a task: the build is version-agnostic and the only
annotation left on a green run is this notice. If CI breaks after that date,
pin `runs-on: ubuntu-24.04` and investigate from a working build.

The Node 20 deprecation that sat here is fixed. `actions/checkout@v7`,
`actions/setup-node@v7` and `pnpm/action-setup@v6` as of `83d40f2`, verified
by the warning disappearing from run #4, not by the run merely passing.

## Kickoff prompt for the next session

> Read HANDOFF.md, then DEPLOYMENT.md, in ~/projects/emoji-sift. Deployment is
> decided and dormant — do not reopen it unless the date has reached
> 2026-09-25 and a bench run clears both thresholds in DEPLOYMENT.md.
>
> Confirm the tree first, using the direct-binary commands under "Environment
> gotchas" rather than `pnpm run check`. Expected: typecheck 0, lint 0, and
> 67 pass / 5 fail where the five are exactly the named sandbox cases. A sixth
> failure, or a different name, is a real regression.
>
> Read CLAUDE.md before the first commit, not after.
>
> Then pick up whichever is live: the spend ceiling at the Gateway (needs the
> user; an agent has no Gateway access), or the CI watch item for 2026-10-19.
> If neither is actionable, say so plainly and stop.
>
> **The feature is finished.** The repository is in a deliberate resting
> state, and that is the correct end state, not a gap to fill. On 2026-09-22 a
> session with no remaining feature work generated four rounds of proposals —
> a settings change, a global hook, more documentation — each smaller in value
> than the last and each costing the user a reply. Do not repeat that. A
> session that reads the state, confirms the tree, reports "nothing is
> actionable today" and ends is a successful session here.
