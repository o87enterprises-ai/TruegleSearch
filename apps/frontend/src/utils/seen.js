import { mediaKey } from './videoEmbed';

// What this browser has already been shown — so the feed never offers it again.
//
// THE BUG THIS FIXES: `seen` was a useRef(new Set()) inside useUpNext, which
// means it lived exactly as long as the React tree did. Reload the tab, come
// back tomorrow, or let a phone browser recycle the page in the background and
// the set came back EMPTY — so the feed cheerfully re-offered the same clips it
// had already walked you through, forever. That is the "stuck watching the same
// videos over and over" report: not a bad ranker, an amnesiac one.
//
// Keys only. No titles, no URLs, no timestamps — a media key is already the
// identity the rest of the player uses (see mediaKey), and a bare list of them
// says nothing about a person that their own watch history doesn't say louder.
// It never leaves the device.
const KEY = 'truegle_player_seen_v1';

// Enough to keep a long session honest without letting the entry grow forever.
// At ~24 chars a key this is well under 20KB, and the oldest entries falling
// off is the RIGHT behaviour — something you were offered a thousand videos ago
// is fair game again.
const CAP = 600;

// Insertion-ordered: a Set iterates oldest-first, which is exactly the trim we
// want and saves keeping a parallel array.
function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return new Set(Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

let keys = read();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...keys]));
  } catch { /* private mode / quota — the feed still works, it just forgets */ }
}

/** Has this browser already been offered (or played) this media? */
export function hasSeen(source) {
  const k = typeof source === 'string' ? source : mediaKey(source);
  return !!k && keys.has(k);
}

/**
 * Remember that this was shown. Re-marking something moves it to the newest
 * end, so a video you keep coming back to is the last thing to be forgotten.
 */
export function markSeen(source) {
  const k = typeof source === 'string' ? source : mediaKey(source);
  if (!k) return;
  keys.delete(k);
  keys.add(k);
  while (keys.size > CAP) keys.delete(keys.values().next().value);
  persist();
}

/** Mark a whole candidate list at once — one write instead of N. */
export function markAllSeen(sources) {
  let touched = false;
  for (const s of sources || []) {
    const k = typeof s === 'string' ? s : mediaKey(s);
    if (!k) continue;
    keys.delete(k);
    keys.add(k);
    touched = true;
  }
  if (!touched) return;
  while (keys.size > CAP) keys.delete(keys.values().next().value);
  persist();
}

/** The newest keys, for the backend's `exclude` parameter. */
export const recentSeen = (limit = 50) => [...keys].slice(-limit);

/**
 * Start over. Offered in the UI next to the taste profile: a list of everything
 * you've been shown that you can't clear is just a quieter dossier.
 */
export function forgetSeen() {
  keys = new Set();
  persist();
}

export const seenCount = () => keys.size;
