# Deployment — the decision, 2026-09-22

Scoping document for What's LEFT item 1. It answers five questions and
implements none of them. Implementation follows the decision, not this file.

**Decision: do not launch yet.** Question 5 is answered "not yet", which makes
1–4 conditional. They are scoped below anyway, because the scoping is the
work item and a later session should not have to redo it — but nothing here
is built until the launch decision flips.

---

## 5. Whether to launch at all yet — answered first

**Not yet. Revisit after 2026-09-25.**

The blocker is upstream availability, and no work in this repository fixes it.

| Evidence | Measurement | Source |
| --- | --- | --- |
| Hard failure rate | 4 of 10, then 2 of 10 queries lost to 503s | Two benches, 2026-09-22 |
| Retries already spent | 6 attempts per lost query | Same |
| Response spread | 1.3s to 68s for identical work | Same |
| Fallback providers | `fallbacksAvailable: []` | Gateway response |

A 20–40% failure rate is *after* the retry chain has been exhausted. The
remaining lever inside this codebase is more retries, which raises cost and
latency without raising the ceiling, because a single provider that is down is
down for every attempt.

**Two things make waiting cheap rather than merely cautious:**

- **Promotional free pricing ends 2026-09-25**, three days from this decision.
  That change should reduce load, and load is the most plausible cause of the
  503s. Launching two days before the event most likely to fix the blocker
  inverts the sequencing.
- **Nothing degrades while waiting.** The feature work is complete and tested.
  There is no perishable work sitting idle.

**What the handoff got wrong here, corrected:** it names "a loading state and
an honest error path" as the launch minimum, implying they are unbuilt. Both
exist in `web/app.js`:

- `status.textContent = 'sifting…'` on request start
- an escalation to `still sifting — the model is busy…` at 6000ms
- the server's 503 text surfaced verbatim, not replaced by a generic failure
- a per-session `Map` cache, so a repeated query in one tab costs nothing

So the launch minimum is already met on the UI side. The blocker is solely the
upstream failure rate.

### What would flip this decision

Re-run `pnpm run bench` on or after 2026-09-25 and read two numbers:

- **Unavailable count.** 0–1 of 10 across two consecutive runs is a launch
  signal. 2+ is not.
- **Worst response time.** Under ~15s is acceptable behind the existing
  `still sifting` notice. A 68s outlier is not, whatever the failure rate.

If both clear, answer questions 1–4 and implement. If they do not, this item
returns to dormant with the new measurements appended here.

---

## Questions 1–4 — scoped, not decided

Conditional on the launch decision flipping. Each records the constraint and a
recommendation, so the implementing session starts from a position rather than
a blank page.

### 1. Host and binding

**Constraint.** `server.listen(PORT, '127.0.0.1', …)` at the bottom of
`src/server.mts` hard-codes loopback. The comment there states why: the
process holds a gateway key and has no authentication. A platform behind a
proxy needs `0.0.0.0`.

**Recommendation: an env-driven bind with loopback as the default.** Reading
`HOST` from the environment and defaulting to `127.0.0.1` keeps the safe value
for anyone who clones and runs it, and requires the deployment to opt in
explicitly. A config value that defaults to `0.0.0.0` inverts that, and the
failure mode is an unauthenticated keyholder on the local network.

`AI_GATEWAY_API_KEY` moves from `.env` to the platform's secret store.
`src/env.ts` already handles an absent `.env` with the key in the environment
— that path is tested (`an absent .env is fine when the key is in the
environment`), so no code change is needed for the key itself.

### 2. Rate limiting — blocking

**Constraint.** `MAX_CONCURRENT_SIFTS = 4` is global, not per-IP. It bounds
simultaneous cost, never total cost: a script staying under four in flight
bills indefinitely. Every accepted query is one Jev request of 101 score
questions, ~14,780 tokens.

**Already closed:** the cross-origin half. `src/request-guard.ts` requires
`application/json` (forcing a preflight that CORS blocks) and rejects a
foreign `Origin`, so another site cannot spend the key from a visitor's
browser. Per-IP limiting addresses the direct client — a script — which that
guard does not touch.

**Recommendation: a fixed window per IP, rejecting with 429 and `retry-after`.**
The endpoint already returns exactly that shape for the concurrency cap, and
`web/app.js` already surfaces the server's error text, so a rejected caller
sees a real message with no client change. Pick the window against the
observed usage of a single-page toy: the cost per request is known and fixed,
so the window is a spend decision, not a capacity one.

Note the interaction with question 3: idle-fire means one user typing a
sentence can legitimately emit several requests in a few seconds. A window
tuned for one-request-per-user will reject normal use.

### 3. Idle-fire

**Constraint.** `IDLE_MS = 1200` in `web/app.js` fires a request 1200ms after
typing stops. Each fire is a full 101-question evaluation.

**Recommendation: raise it, and decide alongside question 2, not before.**
The two knobs control the same quantity — requests per user per minute — and
tuning them independently produces either a rate limit that rejects normal
typing or an idle-fire that defeats the limit. An explicit submit is the
strongest cost control and the largest change to how the thing feels; the
fly-out animation reads as responsive because it is speculative.

The per-session cache reduces the cost of re-typing but not of typing
forward, since each prefix is a distinct key.

### 4. Spend ceiling

**Recommendation: set a hard monthly limit at the Gateway before the first
public request. Independent of everything above, and not negotiable.**

Rate limiting is a guess about traffic. A spend ceiling is the guarantee that
the guess being wrong costs a known amount. It is configured outside this
repository, so it survives any code defect here — including one introduced by
the rate-limiting work itself.

This is the one item worth doing even if the launch decision stays "not yet",
because the cost of doing it is minutes and the cost of skipping it is
unbounded.

---

## Sandbox note for the next agent session

`pnpm run bench` cannot be run by an agent: it needs the key in `.env`, which
the sandbox denies reading. Verified again 2026-09-22 — the file exists on
disk and reads as absent inside the sandbox. A person runs it and pastes the
output; the two numbers under "What would flip this decision" are what to
read from it.

---

## Live measurement, 2026-09-22 ~16:40 IST

Driven through the browser against a running dev server, not `pnpm run bench`.
Three queries, all correct, none failed.

| Query | Result | Time |
| --- | --- | --- |
| `things you can wear` | 12 of 101 — jeans, sock, scarf, gloves, sunglasses, shirt, boot, ring, hat, crown | **4.9s** |
| `i need to lose weight` | 4 of 101 — broccoli, apple, egg, basketball | **34.8s** |
| `things a magnet could attract` | 12 of 101 — paperclip, pushpin, key, safety pin, scissors, wrench, screwdriver, lock, coin, compass, hammer | **17.9s** |

**0 failures in 3 queries**, which is better than the 20–40% loss rate the
benches measured earlier the same day. **Latency is the problem, not
availability:** 4.9s, 17.9s, 34.8s. The `still sifting — the model is busy…`
notice fired on the two slow ones and did its job, and the previous row stayed
on screen throughout rather than blanking.

Every feature the reference video shows was verified working in the same pass:
the pile, the fly-up, the results row, the `×` clear and the fall-back.

**Effect on the launch decision: unchanged, "not yet".** A median wait near 18s
is not a public experience, and the reopen thresholds in this document name
"under ~15s" as acceptable. Two of three runs missed that. The sample is three
queries, not a bench, so it refines the picture rather than replacing it.

**Effect on recording: record now, but expect retakes.** A 35s wait is unusable
in a demo; a 5s wait is fine. The queries return correct results every time, so
retaking until a fast run lands is a workable approach today.
