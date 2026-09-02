// One post from every source in turn — the feed's ordering rule.
//
// ── WHY NOT JUST SORT BY DATE ───────────────────────────────────────────────
//
// /api/social/feed already returns a merged `results` array sorted newest
// first, and using it is the obvious thing. It is also wrong for this feed.
// The sources post at wildly different rates: Hacker News front page turns
// over in hours, a subreddit in minutes, a GitHub trending list in days. Sort
// the union by date and the fastest source wins every slot at the top — you
// get forty Reddit posts, then Hacker News, and GitHub effectively never
// appears at all. The reader concludes the other sources are broken.
//
// So the page ignores that merge and interleaves the per-platform arrays the
// same response already carries: one from each source that still has
// something, then one from each again, until they run dry. A source with two
// posts contributes both; a source with two hundred does not drown the rest.
//
// ── WHY THE ROUND IS SHUFFLED ───────────────────────────────────────────────
//
// A stable round order is still a ranking: whoever is first in the object is
// first on the page, every round, forever. Shuffling WITHIN each round keeps
// the one-each guarantee — which is the part that matters — while making the
// order of any given three cards unpredictable. `rng` is injectable so a test
// can pin the order and assert the guarantee rather than the shuffle.

/**
 * Interleave per-source arrays, one item from each source per round.
 *
 * @param {Record<string, any[]>} bySource  e.g. { reddit: [...], github: [...] }
 * @param {{ shuffle?: boolean, rng?: () => number }} [opts]
 * @returns {any[]} a flat array in round-robin order
 */
export function roundRobin(bySource, { shuffle = true, rng = Math.random } = {}) {
  if (!bySource || typeof bySource !== 'object') return [];

  // Drop sources with nothing to give up front, so an empty source never
  // costs a slot and never appears in the shuffle.
  const lanes = Object.entries(bySource)
    .filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
    .map(([source, rows]) => ({ source, rows, i: 0 }));

  if (!lanes.length) return [];

  const out = [];
  // The longest lane decides how many rounds there are; every other lane
  // simply stops contributing once it is spent.
  const rounds = Math.max(...lanes.map((l) => l.rows.length));

  for (let r = 0; r < rounds; r += 1) {
    const live = lanes.filter((l) => l.i < l.rows.length);
    if (!live.length) break;
    for (const lane of (shuffle ? shuffled(live, rng) : live)) {
      out.push(lane.rows[lane.i]);
      lane.i += 1;
    }
  }
  return out;
}

/** Fisher-Yates over a copy. Never mutates the caller's array. */
function shuffled(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default roundRobin;
