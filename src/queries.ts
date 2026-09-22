/**
 * The acceptance set.
 *
 * Each query names emoji that must appear and emoji that must not. These are
 * judgements about the world rather than about one model's current weights:
 * a paperclip is ferrous whatever Jev scores it, so a failure here is a real
 * regression rather than model drift.
 *
 * `must` and `mustNot` are deliberately short. Listing every plausible answer
 * turns the set into a snapshot of today's output, which then fails on any
 * change whether or not the change was bad. Listing only the unarguable cases
 * keeps a failure meaningful.
 *
 * Run with `pnpm run bench`.
 */
export type SavedQuery = {
  text: string;
  /** Why this query is in the set — what it proves, or what it once broke. */
  note: string;
  /** Emoji ids that must be in the row. Their absence is a failure. */
  must: string[];
  /** Emoji ids that must not be in the row. Their presence is a failure. */
  mustNot: string[];
  /**
   * Emoji ids that every `must` entry has to outrank.
   *
   * For answers that are defensible but should not lead. 🪨 rock is a fair
   * reading of "start a band", so forbidding it would assert something untrue
   * about the world; requiring the instruments to beat it says what actually
   * matters for this interface.
   */
  outranks?: string[];
};

export const QUERIES: SavedQuery[] = [
  {
    text: 'things you can wear',
    note: 'The easy case. Plain description, should be near-unanimous.',
    must: ['jeans', 'socks', 'scarf', 'gloves'],
    mustNot: ['pizza', 'hammer', 'broccoli'],
  },
  {
    text: 'things a magnet could attract',
    note: 'World knowledge, not keywords: no emoji name mentions metal.',
    must: ['paperclip', 'key', 'hammer'],
    // Organic and plastic objects. A magnet does not pick these up whatever
    // the model scores them.
    mustNot: ['apple', 'teddy_bear', 'rose', 'balloon'],
  },
  {
    text: 'i need to lose weight',
    note: 'A goal, not a description. Broke the first question wording.',
    must: ['broccoli'],
    mustNot: ['donut', 'cupcake', 'bacon'],
  },
  {
    text: 'things that make noise',
    note: 'Instruments plus alarms and bells — cuts across categories.',
    must: ['drum', 'bell'],
    // Silent by nature. These appeared when the question was a yes/no bar,
    // which is what moved this project to ranking.
    mustNot: ['feather', 'rock', 'socks'],
  },
  {
    text: 'things you would take to a beach',
    note: 'Situational. Needs inference about an activity, not a property.',
    must: ['sunglasses'],
    mustNot: ['hammer', 'briefcase'],
  },
  {
    text: 'things that are sharp',
    note: 'A physical property the names do not state.',
    must: ['scissors'],
    mustNot: ['teddy_bear', 'balloon', 'sponge'],
  },
  {
    text: 'i am hosting a dinner party',
    note: 'Goal-shaped, like the weight one, but about food and setting.',
    must: ['candle'],
    mustNot: ['hammer', 'toothbrush'],
  },
  {
    text: 'things smaller than a mouse',
    note: 'Relative size. Hard: the pile has no scale information.',
    must: ['paperclip', 'coin'],
    mustNot: ['piano', 'backpack'],
  },
  {
    text: 'start a band',
    note:
      'Goal-shaped. 🪨 rock scores ~2.0 here and that is a fair reading of ' +
      '"start a rock band", so it is not forbidden — the instruments simply ' +
      'have to outrank it.',
    must: ['guitar', 'drum'],
    mustNot: [],
    outranks: ['rock'],
  },
  {
    text: 'instruments you could play in a band',
    note:
      'The same intent stated without the pun. 🪨 has no reading here, so ' +
      'its presence would be a real failure rather than a defensible one. ' +
      '🔑 key is the other pun and does appear: a key is a tonal centre, ' +
      'which is band vocabulary but not an instrument you could play, so the ' +
      'instruments have to outrank it.',
    must: ['guitar', 'drum', 'trumpet'],
    mustNot: ['rock', 'pizza', 'hammer'],
    outranks: ['key'],
  },
];
