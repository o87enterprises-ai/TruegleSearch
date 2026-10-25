// THE SHAPE OF A YOUTUBE CLIP THAT NEVER SAID WHAT IT IS.
//
// `vertical` is read off the URL (a /shorts/ path), so it only exists when the
// link we were handed already said "Short". Search rows, imported playlists and
// anything saved before the flag was kept arrive as plain /watch?v= links, and
// a Short played from one of those was framed 16:9 and, in full screen, turned
// the phone sideways (owner, 2026-10-24: pasted links were right, search and
// playlist plays were not).
//
// YouTube's keyless oEmbed answers a /shorts/ URL with portrait numbers for a
// genuine Short and landscape ones for anything else — the same proof the Reels
// feed relies on (utils/reelsDraw). It is asked through OUR backend, one clip at
// a time, when that clip starts playing: YouTube never sees the visitor, and a
// whole playlist is never enumerated.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const CAP = 500;

const known = new Map();   // mediaKey → boolean (true = portrait)
const inflight = new Map();

const idOf = (key) => (String(key).startsWith('youtube:') ? String(key).slice(8) : '');

/** What we already know about this clip: true / false, or undefined for "never asked". */
export const knownTall = (key) => known.get(key);

/**
 * Is this YouTube clip portrait? Resolves false when oEmbed has no answer
 * (private, embedding off, backend down) — an unknown clip keeps the default
 * landscape treatment, which is what it had before this existed.
 * @param {string} key a mediaKey, e.g. "youtube:abc123def45"
 */
export function lookupTall(key) {
  const id = idOf(key);
  if (!id) return Promise.resolve(false);
  if (known.has(key)) return Promise.resolve(known.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const url = `https://www.youtube.com/shorts/${id}`;
  const p = fetch(`${BACKEND}/api/media/titles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: [url] }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const t = d?.titles?.[url];
      const w = Number(t?.width);
      const h = Number(t?.height);
      // No numbers is "don't know", not "landscape" — leave it unremembered so
      // a later play can ask again.
      if (!(w > 0 && h > 0)) return false;
      if (known.size >= CAP) known.delete(known.keys().next().value);
      known.set(key, h > w);
      return h > w;
    })
    .catch(() => false)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
