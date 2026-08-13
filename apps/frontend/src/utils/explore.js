// Deliberate exploration — the thing that actually breaks a feed out of a loop.
//
// THE PROBLEM THIS SOLVES, precisely. The draw was already random (see
// feedDraw.js) and the seen-ledger already stopped exact repeats (see seen.js),
// and people were STILL reporting the same neighbourhood over and over. Both of
// those work on the candidates they are given, and the candidates never moved:
// every lookup was seeded from the current title, the liked channels, and the
// heaviest words in the taste profile. Shuffling harder inside one basin does
// not get you out of it. Only asking a different question does.
//
// So a fixed fraction of picks ignores taste entirely:
//
//   - A RANDOM DEPTH into the platform pool, rather than its head. `trending`
//     is ORDER BY score DESC, so the top of it is the same rows every single
//     time; `exclude` only carries 60 keys, and past that the head simply
//     repeats. A random offset reaches the long tail, which is real, organic,
//     human-voted content that the score ordering would never surface.
//
//   - A RANDOM SEED WORD, when the pool is thin. Not from the taste profile —
//     that is the basin — from a deliberately broad list that has nothing to do
//     with this browser.
//
// Explored candidates are scored FLAT, not by taste (useUpNext does this). An
// exploration ranked by the same profile it is meant to escape is not an
// exploration, it is the same answer with extra steps.

// One pick in five. Enough that a sitting reliably leaves the basin; low enough
// that four out of five swipes are still things the profile says you want.
// Tuned by feel, not by data — there is no data yet, and pretending otherwise
// would be worse than saying so.
export const EXPLORE_RATE = 0.2;

/** Should this pick be an exploration? `rand` is injectable for the test. */
export const shouldExplore = (rand = Math.random) => rand() < EXPLORE_RATE;

// How deep into the pool an exploration may reach. Past a few hundred rows the
// tail is mostly things with a single play, which is a different feed rather
// than a wider one.
export const MAX_OFFSET = 240;

/**
 * A random depth into the platform pool, quantised to the page size so
 * consecutive explorations land on page boundaries rather than sliding windows
 * that mostly overlap.
 */
export function exploreOffset(limit = 24, rand = Math.random) {
  const pages = Math.max(1, Math.floor(MAX_OFFSET / Math.max(1, limit)));
  return Math.floor(rand() * pages) * limit;
}

// Broad, neutral, and deliberately unlike anything a taste profile would
// produce — these exist to ask a question this browser has never asked. Kept
// short and general on purpose: a long list of niches is just somebody else's
// taste profile, and a narrow seed lands back in a basin, only a stranger's.
const SEEDS = [
  'live performance', 'documentary', 'short film', 'how it is made',
  'field recording', 'stand up comedy', 'archive footage', 'street interview',
  'workshop', 'first look', 'behind the scenes', 'time lapse',
  'cover version', 'walkthrough', 'restoration', 'day in the life',
  'explained', 'unboxing', 'rehearsal', 'drone footage',
];

/** A search seed with no relationship to what this browser likes. */
export function exploreSeed(rand = Math.random) {
  return SEEDS[Math.floor(rand() * SEEDS.length) % SEEDS.length];
}

export const EXPLORE_SEEDS = SEEDS;
