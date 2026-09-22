# emoji-sift

Type a description, and the emoji that match fly out of the pile.

Built with [Jev](https://vercel.com/ai-gateway/models/jev), TypeSafe AI's System One
evaluation model, called through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway).

## Why it needs a model at all

Keyword search handles "things you can wear". It does not handle these:

| Query | What comes back |
| --- | --- |
| `things a magnet could attract` | 🔑 🧭 ✂️ 🔨 🪛 🔒 📎 |
| `i need to lose weight` | 🥦 🍎 🥕 🥚 🏀 |

The first needs to know which objects are ferrous — no emoji name mentions
metal. The second is a goal, not a description; nothing in it names a food.

## How it works

One request carries the query as shared state and one score question per
emoji. The questions are independent, so Jev answers all of them in parallel,
and the query itself is sent once: the questions name the emoji and refer to
the query in state rather than repeating it. That keeps the payload the same
size whatever the user types, and keeps their text out of the instructions,
which is a stronger boundary than escaping it.

Each answer is a position on a four-level scale, from "unrelated" to "an
obvious answer". Code owns what happens next: rank by score, drop anything
below a floor, take the top few.

```ts
const { matches } = await sift('things a magnet could attract');
// matches: [{ emoji: { char: '🔑', name: 'key' }, score: 2.8 }, …]
```

Ranking rather than a yes/no per emoji is what makes open-ended queries work.
"Things that make noise" is true of almost any object and "i need to lose
weight" is true of almost none, so a fixed yes/no bar returned 27 matches for
one and 2 for the other. Ranking asks which emoji answer *best*.

## Run it

Requires Node.js 22.18 or later and an
[AI Gateway API key](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys).

```bash
pnpm install
echo 'AI_GATEWAY_API_KEY=your_key_here' > .env
pnpm run dev
```

Then open http://127.0.0.1:5174. The key stays server-side; the browser posts
a query and gets back the ranked row.

There is also a terminal harness:

```bash
pnpm run sift "things you can wear"   # one query, with scores
pnpm run sift                         # interactive prompt
pnpm run bench                        # every saved query at once
```

## Tuning

Two knobs, both environment variables on the 0–3 score scale:

| Variable | Default | What it does |
| --- | --- | --- |
| `SIFT_FLOOR` | `1.5` | Minimum score to appear at all |
| `SIFT_LIMIT` | `12` | Most emoji shown at once |

```bash
SIFT_FLOOR=1.2 pnpm run sift "things that belong in a kitchen"
```

The floor default is measured rather than guessed. Goal-shaped queries score
lower across the board than descriptive ones — "i am hosting a dinner party"
tops out around 2.2 where "things you can wear" reaches 2.9 — so a floor at
1.8 cut the goal queries to two or three results. At 1.5 those roughly double
while the strong queries are untouched, because their first rejected answer
sits at 1.7–1.8.

`pnpm run bench` prints every saved query with its top hit and the first answer
below the line, which is where you find out whether a wrong result is a bad
floor or a badly worded question.

## A note on availability

Jev has a single provider and no fallback. Measured over five consecutive runs
of one query: success, 503, success, 503. The server retries transient
failures; the terminal tools fail fast on purpose, because when the endpoint is
struggling that is worth seeing.

## Development

```bash
pnpm run check   # typecheck, lint, tests
```

## Credit

The interaction is a rebuild of [a demo by Stefan](https://x.com/heystefan_/status/2101369117496521042).
