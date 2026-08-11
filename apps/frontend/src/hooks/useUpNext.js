import { useCallback, useMemo } from 'react';
import { getPlayable, mediaKey, urlFromKey } from '../utils/videoEmbed';
import { titleFromUrl } from '../utils/playerLink';
import { tasteScore, likedChannels, likedWords, tokens, isDisliked } from '../utils/taste';
import { hasSeen, markSeen, markAllSeen, recentSeen } from '../utils/seen';
import { scoreCandidates, draw, dedupeScored, POOL } from '../utils/feedDraw';

// What plays next, and what fills an empty player.
//
// THE BUG THIS REPLACES: the old version searched the current video's TITLE and
// played the first result whose `src` it hadn't seen. Searching a title returns
// the same video — from youtu.be, from an /embed/ URL with a ?si= suffix, from
// a mirror — so "the next video" was the SAME video, over and over, because
// every copy had a different src string. Identity is now mediaKey(), and the
// video that just finished is excluded by identity, not by string.
//
// WHAT IT DOES INSTEAD: assemble candidates from three free sources, score them
// against this browser's private taste profile plus the platform's anonymous
// vote pool, and pick from the good ones.
//
//   1. Channels you keep thumbing up — their latest uploads, via the keyless
//      per-channel feed we already proxy. This is the strongest signal there
//      is and it costs nothing.
//   2. The platform pool — what everyone's thumbs have surfaced. Cold start:
//      it works on your very first click, before you've voted on anything.
//   3. Search, seeded from the current title AND your most-weighted words —
//      the old path, kept as the tail so there is always something next.
//
// Nothing here is a "recommendation model". It is a weighted sum over three
// candidate lists, which is the honest shape of the thing and the only shape
// that runs for $0.
//
// TWO THINGS CHANGED WHEN SWIPING BECAME THE WAY PEOPLE MOVE THROUGH IT:
//
//   PICKING IS NO LONGER ARGMAX. Taking the single highest-scoring candidate is
//   a pure function of a profile that barely moves between swipes, so swiping
//   away from a video and swiping back handed you the identical "next" one. The
//   pick is now a weighted random draw over the best handful, which is what
//   makes two swipes in a row go two different places while both still being
//   things you'd plausibly want. Scores still decide the ODDS — this is not
//   "play something random", it is "pick among the good ones".
//
//   BEING SHOWN SOMETHING IS NOW REMEMBERED ACROSS SESSIONS. `seen` was a ref,
//   so it emptied on every reload and the feed walked you back through the same
//   clips the next day. It lives in localStorage now (utils/seen.js).
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const toSource = (r, extra = {}) => {
  const base = getPlayable(r.url || r.pageUrl || '');
  return base ? {
    ...base,
    title: r.title || titleFromUrl(r.url || r.pageUrl || ''),
    pageUrl: r.url || r.pageUrl,
    poster: r.image || r.poster || r.thumbnail,
    ...extra,
  } : null;
};

// Two listings of the same upload often differ only in punctuation and a
// "(Official Video)" suffix, and mediaKey can't catch a genuine re-upload
// under a new id. Word overlap can: if nearly every meaningful word matches,
// it's the same thing again.
function nearDuplicate(a, b) {
  const wa = new Set(tokens(a));
  const wb = tokens(b);
  if (wa.size < 2 || wb.length < 2) return false;
  const hit = wb.filter((w) => wa.has(w)).length;
  return hit / Math.min(wa.size, wb.length) >= 0.8;
}

const json = (url, opts) => fetch(url, opts)
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);

export function useUpNext() {
  const remember = useCallback((source) => markSeen(source), []);

  // Everything the three lookups can offer, already de-duplicated and filtered
  // down to things worth playing. Shared by pick() and fill() so a swipe and a
  // top-up ask the same question the same way.
  const candidatesFor = useCallback(async (current, { wide = false } = {}) => {
    const currentKey = mediaKey(current);
    const currentTitle = current?.title || '';

    const usable = (s) => {
      if (!s?.src) return false;
      const k = mediaKey(s);
      if (!k || k === currentKey || hasSeen(k)) return false;
      if (isDisliked(s)) return false;
      // A different id for the same upload is still the same upload.
      return !nearDuplicate(currentTitle, s.title);
    };

    // ── 1. channels this browser keeps thumbing up ──────────────────────────
    const fromChannels = async () => {
      const names = likedChannels(3);
      if (!names.length) return [];
      const lists = await Promise.all(names.map(async (name) => {
        const r = await json(`${BACKEND}/api/creators/resolve?handle=${encodeURIComponent(name.replace(/^@/, ''))}`);
        const channelId = r?.channelId;
        if (!channelId) return [];
        const f = await json(`${BACKEND}/api/creators/${channelId}/videos`);
        return (f?.videos || []).slice(0, 8).map((v) => toSource(v, { channel: name }));
      }));
      // A liked channel is a strong, cheap signal — weight it above the pool.
      return lists.flat().filter(Boolean).map((s) => ({ s, boost: 4 }));
    };

    // ── 2. the platform's anonymous vote pool ───────────────────────────────
    const fromPlatform = async () => {
      const exclude = recentSeen(50).join(',');
      // A cold launch asks for more than a single swipe does: it has a whole
      // queue to fill and nothing playing to narrow things down.
      const limit = wide ? 48 : 24;
      const d = await json(`${BACKEND}/api/media/trending?limit=${limit}&exclude=${encodeURIComponent(exclude)}`);
      return (d?.results || []).map((r) => {
        const s = toSource({ ...r, url: r.pageUrl || urlFromKey(r.mediaKey) }, { channel: r.channel });
        // Platform score is already a 0–1-ish confidence bound; scale it into
        // the same range the taste weights live in.
        return s ? { s, boost: (Number(r.score) || 0) * 3 } : null;
      }).filter(Boolean);
    };

    // ── 3. search, seeded by what's playing and what you like ───────────────
    //
    // WITH NOTHING PLAYING there is no title to seed from, which is why an
    // empty player used to stay empty: the seed was '' and the rung returned
    // immediately. The taste profile's heaviest words are the seed instead, so
    // a launch with an empty viewport asks for more of what this browser
    // already likes rather than asking for nothing.
    const fromSearch = async () => {
      const seed = (currentTitle || titleFromUrl(current?.pageUrl || current?.src || '')
        || likedWords(4).join(' ')).slice(0, 120);
      if (!seed) return [];
      const d = await json(`${BACKEND}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: seed, filters: { category: 'videos', perPage: wide ? 32 : 16 } }),
      });
      return (d?.results || []).map(toSource).filter(Boolean).map((s) => ({ s, boost: 0 }));
    };

    // Channels and the pool answer fast and are the good candidates; search is
    // the fallback and only worth waiting for if they came back thin. A cold
    // fill needs the breadth, so it asks for all three at once.
    let raw = (await Promise.all([fromChannels(), fromPlatform()])).flat();
    let scored = scoreCandidates(raw, usable, tasteScore);
    if (scored.length < (wide ? POOL : 1)) {
      scored = dedupeScored([...scored, ...scoreCandidates(await fromSearch(), usable, tasteScore)]);
    }
    return scored;
  }, []);

  /**
   * Pick the next thing to play after `current` — a weighted random draw over
   * the best candidates, so consecutive swipes go somewhere new.
   * @returns a player source, or null if nothing suitable turned up.
   */
  const pick = useCallback(async (current) => {
    remember(current);
    const scored = await candidatesFor(current);
    const [choice] = draw(scored, 1);
    if (choice) markSeen(choice);
    return choice || null;
  }, [remember, candidatesFor]);

  /**
   * Build a whole run of things to play — what an empty viewport is filled
   * with on launch. Same scoring, drawn without replacement so the batch isn't
   * ten copies of one artist.
   * @returns an array of sources, newest interest first. May be shorter than
   *          `count`, and is empty when the backend has nothing to offer.
   */
  const fill = useCallback(async (current, count = 6) => {
    const scored = await candidatesFor(current, { wide: true });
    const chosen = draw(scored, count);
    markAllSeen(chosen);
    return chosen;
  }, [candidatesFor]);

  // Stable identity: callers put this in useCallback dependency lists, and a
  // fresh object every render would rebuild advance() (and re-run the effects
  // that depend on it) on every single keystroke elsewhere in the tree.
  return useMemo(() => ({ pick, fill, remember }), [pick, fill, remember]);
}

export default useUpNext;
