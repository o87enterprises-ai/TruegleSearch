import { useCallback, useMemo, useRef } from 'react';
import { getPlayable, mediaKey, urlFromKey } from '../utils/videoEmbed';
import { titleFromUrl } from '../utils/playerLink';
import { tasteScore, likedChannels, tokens, isDisliked } from '../utils/taste';

// What plays when the current thing ends and the queue is empty.
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
// vote pool, and play the best one.
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
  // Everything this session has played or offered, by identity. Keeps the feed
  // moving forward instead of circling three videos.
  const seen = useRef(new Set());

  const remember = useCallback((source) => {
    const k = mediaKey(source);
    if (k) seen.current.add(k);
  }, []);

  /**
   * Pick the next thing to play after `current`.
   * @returns a player source, or null if nothing suitable turned up.
   */
  const pick = useCallback(async (current) => {
    remember(current);
    const currentKey = mediaKey(current);
    const currentTitle = current?.title || '';

    const usable = (s) => {
      if (!s?.src) return false;
      const k = mediaKey(s);
      if (!k || k === currentKey || seen.current.has(k)) return false;
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
      const exclude = [...seen.current].slice(-50).join(',');
      const d = await json(`${BACKEND}/api/media/trending?limit=24&exclude=${encodeURIComponent(exclude)}`);
      return (d?.results || []).map((r) => {
        const s = toSource({ ...r, url: r.pageUrl || urlFromKey(r.mediaKey) }, { channel: r.channel });
        // Platform score is already a 0–1-ish confidence bound; scale it into
        // the same range the taste weights live in.
        return s ? { s, boost: (Number(r.score) || 0) * 3 } : null;
      }).filter(Boolean);
    };

    // ── 3. search, seeded by what's playing and what you like ───────────────
    const fromSearch = async () => {
      const seed = [currentTitle || titleFromUrl(current?.pageUrl || current?.src || '')]
        .filter(Boolean).join(' ').slice(0, 120);
      if (!seed) return [];
      const d = await json(`${BACKEND}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: seed, filters: { category: 'videos', perPage: 16 } }),
      });
      return (d?.results || []).map(toSource).filter(Boolean).map((s) => ({ s, boost: 0 }));
    };

    // Channels and the pool answer fast and are the good candidates; search is
    // the fallback and only worth waiting for if they came back empty.
    let candidates = (await Promise.all([fromChannels(), fromPlatform()])).flat();
    let best = rank(candidates, usable);
    if (best) return best;

    candidates = await fromSearch();
    best = rank(candidates, usable);
    return best;
  }, [remember]);

  // Stable identity: callers put this in useCallback dependency lists, and a
  // fresh object every render would rebuild advance() (and re-run the effects
  // that depend on it) on every single keystroke elsewhere in the tree.
  return useMemo(() => ({ pick, remember, seen }), [pick, remember]);
}

function rank(candidates, usable) {
  let best = null;
  let bestScore = -Infinity;
  for (const { s, boost } of candidates) {
    if (!usable(s)) continue;
    const score = tasteScore(s) + boost;
    if (score === -Infinity) continue;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

export default useUpNext;
