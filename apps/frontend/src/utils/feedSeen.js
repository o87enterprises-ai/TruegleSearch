// Which feed posts this browser has already been shown.
//
// THE BUG THIS PREVENTS is the one utils/seen.js already documents for the
// player: a Set living in a useRef lives exactly as long as the React tree
// does. Reload the tab, come back tomorrow, or let a phone browser recycle the
// page in the background, and it comes back EMPTY — so the feed cheerfully
// re-offers the same posts it already walked you through. useSocialFeed's own
// `seen` ref is that shape, which is fine for deduping ONE session's pages and
// useless for "never show me this twice".
//
// A SIBLING OF seen.js, NOT A REUSE OF IT. seen.js would accept these keys —
// it takes a bare string — but it is capped at 600 entries shared with the
// player's watch ledger, so a long scroll through the feed would silently
// evict the "already watched" record for videos. Two ledgers, two caps, no
// contention.
//
// Keys only: `platform:id`, the same identity useSocialFeed already dedupes
// on. No titles, no URLs, no timestamps. A bare list of post ids says nothing
// about a person that their own history does not say louder, and it never
// leaves the device — there is no server side to this at all, which is what
// keeps "never repeat" from quietly becoming "we track what you read".

const KEY = 'truegle_feed_seen_v1';

// Bigger than the player's 600 because feed posts are cheap and scrolled past
// fast, but still bounded — the oldest falling off is the RIGHT behaviour.
// Something offered two thousand posts ago is fair game again.
const CAP = 2000;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return new Set(Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

// Insertion-ordered: a Set iterates oldest-first, which is exactly the trim we
// want and saves keeping a parallel array.
let keys = read();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...keys]));
  } catch { /* private mode / quota — the feed still works, it just forgets */ }
}

/** Has this browser already been offered this post? */
export function hasSeenPost(key) {
  return typeof key === 'string' && keys.has(key);
}

/** Record posts as offered, trimming the oldest past the cap. */
export function markPostsSeen(list) {
  let changed = false;
  for (const k of list || []) {
    if (typeof k !== 'string' || keys.has(k)) continue;
    keys.add(k);
    changed = true;
  }
  if (!changed) return;
  while (keys.size > CAP) keys.delete(keys.values().next().value);
  persist();
}

/** Forget everything — "show me my history again". */
export function forgetPostsSeen() {
  keys = new Set();
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/** How many posts this browser is currently suppressing. */
export const seenPostCount = () => keys.size;
