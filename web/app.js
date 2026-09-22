const form = document.getElementById('form');
const input = document.getElementById('query');
const clear = document.getElementById('clear');
const status = document.getElementById('status');
const row = document.getElementById('row');
const pile = document.getElementById('pile');

/**
 * Milliseconds of quiet before a query fires on its own.
 *
 * Every request carries 101 questions and ~16K tokens, and cancelling a fetch
 * does not always beat it to the provider, so a short pause spends real money
 * on answers nobody reads. Enter submits immediately; this is the fallback for
 * someone who types and waits.
 */
const IDLE_MS = 1200;

/** Every emoji, by id, so a match can find its pile element. */
const pileNodes = new Map();

/** Ids currently lifted into the row, so we only move what changed. */
let lifted = new Set();

let debounce;
/** The in-flight request, so a newer query can cancel it. */
let inFlight = null;
/** Guards against an older response overwriting a newer one. */
let latestRequestId = 0;

async function loadPile() {
  const res = await fetch('/api/emoji');
  const { emoji } = await res.json();

  // Scatter once, at load. Positions are derived from the index rather than
  // random, so the pile looks the same on every reload and a recording can be
  // repeated take after take.
  emoji.forEach((e, i) => {
    const node = document.createElement('span');
    node.textContent = e.char;
    node.dataset.spread = String((i * 37) % 100);
    node.style.bottom = `${(i % 7) * 13}px`;
    node.style.setProperty('--rest-rotate', `${((i * 53) % 31) - 15}deg`);
    pile.append(node);
    pileNodes.set(e.id, node);
  });

  placePile();
}

/**
 * Convert each emoji's spread into a pixel left offset.
 *
 * A percentage `left` is re-resolved against the element's own box, so it
 * shifts when the emoji grows to row size mid-flight and a pre-computed
 * translate lands short. Pixels stay put, which is what makes the measured
 * offset still correct when the transition ends.
 */
function placePile() {
  const width = pile.clientWidth;
  for (const node of pileNodes.values()) {
    const spread = Number(node.dataset.spread) / 100;
    node.style.left = `${(spread * (width - 40)).toFixed(1)}px`;
  }
}

/**
 * Move the lifted emoji to their row positions and return the rest home.
 *
 * The pile element itself travels rather than a copy appearing in the row:
 * the row holds an invisible placeholder that reserves the slot, and the real
 * emoji is translated onto it. One object moving reads as the thing leaving
 * the pile; two objects appearing and disappearing does not.
 */
function layout(matches) {
  const nextLifted = new Set(matches.map((m) => m.id));

  // Placeholders first, so the row has final geometry before anything is
  // measured. Reading a position mid-transition would aim at a moving target.
  row.replaceChildren();
  for (const m of matches) {
    const slot = document.createElement('span');
    slot.className = 'slot';
    slot.textContent = m.char;
    slot.title = m.score.toFixed(2);
    row.append(slot);
  }

  const slots = [...row.children];

  // Phase 1 — put every emoji back in its resting state, without animating.
  // A node still carrying a transform measures where it currently sits, not
  // where it rests, so the new offset has to be computed from a clean start.
  for (const node of pileNodes.values()) {
    node.style.transition = 'none';
    node.style.transform = '';
    node.style.transitionDelay = '0ms';
  }
  // Size is part of position: the emoji grows to row size, and measuring it
  // at pile size aims the centre-to-centre offset with the wrong width.
  for (const [id, node] of pileNodes) {
    node.classList.toggle('lifted', nextLifted.has(id));
  }

  // Phase 2 — one forced reflow, then every rect below is current.
  void row.offsetHeight;

  const moves = [];
  matches.forEach((m, index) => {
    const node = pileNodes.get(m.id);
    const slot = slots[index];
    if (!node || !slot) return;

    const from = node.getBoundingClientRect();
    const to = slot.getBoundingClientRect();
    moves.push({
      node,
      index,
      // Centre-to-centre, so different glyph widths still land aligned.
      dx: to.left + to.width / 2 - (from.left + from.width / 2),
      dy: to.top + to.height / 2 - (from.top + from.height / 2),
    });
  });

  // Phase 3 — restore transitions and apply, on the next frame so the
  // browser does not collapse the reset and the move into one step.
  requestAnimationFrame(() => {
    for (const node of pileNodes.values()) node.style.transition = '';
    for (const { node, index, dx, dy } of moves) {
      // Stagger by row position rather than by pile position: the row fills
      // left to right, which is the order a reader's eye follows.
      node.style.transitionDelay = `${index * 45}ms`;
      node.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  });

  lifted = nextLifted;
}

/**
 * Answers already paid for, keyed by the normalized query.
 *
 * Retyping a query during tuning or across takes of a recording is common, and
 * the answer does not change between them.
 */
const cache = new Map();

/** Match the server's normalization so "A  b " and "a b" share one entry. */
function cacheKey(query) {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function run(query) {
  const key = cacheKey(query);
  const hit = cache.get(key);
  if (hit) {
    latestRequestId++;
    inFlight?.abort();
    inFlight = null;
    layout(hit.matches);
    status.textContent = `${hit.matches.length} of ${pileNodes.size} · cached`;
    return;
  }

  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;

  const requestId = ++latestRequestId;
  status.textContent = 'sifting…';

  // The server retries transient 503s, which can push a response past ten
  // seconds. Saying so beats a status line that looks stuck.
  const slowNotice = setTimeout(() => {
    if (requestId === latestRequestId) status.textContent = 'still sifting — the model is busy…';
  }, 6000);

  try {
    const res = await fetch('/api/sift', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    const data = await res.json();

    // A superseded response must not overwrite a newer one, even if it
    // arrives last: aborting is not instantaneous.
    if (requestId !== latestRequestId) return;

    if (!res.ok) {
      status.textContent = data.error ?? 'Something went wrong.';
      return;
    }

    cache.set(key, { matches: data.matches });
    layout(data.matches);
    status.textContent = data.matches.length
      ? `${data.matches.length} of ${pileNodes.size} · ${data.ms}ms`
      : 'nothing matched';
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (requestId !== latestRequestId) return;
    status.textContent = 'Could not reach the server.';
  } finally {
    clearTimeout(slowNotice);
    if (inFlight === controller) inFlight = null;
  }
}

function reset() {
  latestRequestId++;
  inFlight?.abort();
  inFlight = null;
  layout([]);
  status.textContent = '';
}

input.addEventListener('input', () => {
  form.classList.toggle('has-text', input.value.trim() !== '');
  clearTimeout(debounce);

  const query = input.value.trim();
  if (!query) {
    reset();
    return;
  }
  debounce = setTimeout(() => void run(query), IDLE_MS);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(debounce);
  const query = input.value.trim();
  if (query) void run(query);
});

clear.addEventListener('click', () => {
  input.value = '';
  form.classList.remove('has-text');
  clearTimeout(debounce);
  reset();
  input.focus();
});

// The row reserves slots by layout, so a resize moves the targets. Re-running
// the same layout re-measures and sends everything to its new home.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    placePile();
    const matches = [...row.children].map((slot, i) => ({
      id: [...lifted][i],
      char: slot.textContent,
      score: Number(slot.title),
    }));
    if (matches.length) layout(matches);
  }, 150);
});

void loadPile();
