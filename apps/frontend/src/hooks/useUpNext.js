import { useCallback, useMemo } from 'react';
import { getPlayable, mediaKey, urlFromKey } from '../utils/videoEmbed';
import { titleFromUrl } from '../utils/playerLink';
import { tasteScore, likedChannels, likedWords, tokens, isDisliked } from '../utils/taste';
import { retentionScore, watchedChannels } from '../utils/retention';
import { hasSeen, markSeen, markAllSeen, recentSeen } from '../utils/seen';
import { scoreCandidates, draw, dedupeScored, poolFor, POOL } from '../utils/feedDraw';
import { shouldExplore, exploreOffset, exploreSeed, EXPLORE_RATE } from '../utils/explore';

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
//
// AND A THIRD, AFTER THE LOOPING WAS REPORTED AGAIN WITH BOTH OF THOSE IN PLACE:
// neither of them moves the CANDIDATES. The draw randomises within whatever the
// three lookups returned, and every one of those lookups is seeded from the
// current title, the liked channels, or the heaviest words in the profile — so
// the neighbourhood never changed and no amount of shuffling inside it could
// leave. Two changes, both here:
//
//   1. EXPLORATION. A fixed fraction of picks (utils/explore.js) ignores taste
//      completely: a random depth into the platform pool, or a random seed word
//      from a list that has nothing to do with this browser. Explored
//      candidates are scored FLAT — ranking an exploration by the profile it
//      exists to escape would put you straight back in the basin.
//   2. THE POOL WIDENS AS THE HEAD IS EXHAUSTED. The seen-filter runs before
//      the draw, so deep into a sitting a "top ten" is assembled from a much
//      thinner survivor list. The share of candidates rejected as already-seen
//      is measured here and drives both a bigger draw pool (poolFor) and a
//      deeper page request — asking for page four instead of re-ranking page
//      one for the fortieth time.
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
  const candidatesFor = useCallback(async (current, { wide = false, explore = false } = {}) => {
    const currentKey = mediaKey(current);
    const currentTitle = current?.title || '';

    // How much of what came back had already been shown. This is the signal
    // that the head of every lookup is exhausted, and it drives both the draw
    // pool and how deep the next request pages — see poolFor.
    let offered = 0;
    let alreadySeen = 0;
    const usable = (s) => {
      if (!s?.src) return false;
      const k = mediaKey(s);
      if (!k || k === currentKey) return false;
      offered += 1;
      if (hasSeen(k)) { alreadySeen += 1; return false; }
      if (isDisliked(s)) return false;
      // A different id for the same upload is still the same upload.
      return !nearDuplicate(currentTitle, s.title);
    };
    const seenRate = () => (offered ? alreadySeen / offered : 0);

    // ── 1. channels this browser keeps thumbing up ──────────────────────────
    const fromChannels = async () => {
      // Thumbed channels first, then ones this browser keeps WATCHING THROUGH.
      // Most people never press a thumb, so keying candidate lookup on votes
      // alone left the strongest and cheapest rung of the feed permanently
      // empty for them — the channel list was the one signal that could not
      // learn from ordinary use.
      const names = [...new Set([...likedChannels(3), ...watchedChannels(3)])].slice(0, 3);
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
    const fromPlatform = async ({ offset = 0 } = {}) => {
      const exclude = recentSeen(50).join(',');
      // A cold launch asks for more than a single swipe does: it has a whole
      // queue to fill and nothing playing to narrow things down.
      const limit = wide ? 48 : 24;
      const d = await json(`${BACKEND}/api/media/trending?limit=${limit}&offset=${offset}&exclude=${encodeURIComponent(exclude)}`);
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
    const searchFor = async (seed) => {
      if (!seed) return [];
      const d = await json(`${BACKEND}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: seed, filters: { category: 'videos', perPage: wide ? 32 : 16 } }),
      });
      return (d?.results || []).map(toSource).filter(Boolean).map((s) => ({ s, boost: 0 }));
    };

    const fromSearch = () => searchFor(
      (currentTitle || titleFromUrl(current?.pageUrl || current?.src || '')
        || likedWords(4).join(' ')).slice(0, 120),
    );

    // ── the exploration path ────────────────────────────────────────────────
    //
    // Neither of the sources above is used: liked channels and a title-seeded
    // search are the basin. A random depth into the pool is organic — real
    // uploads that real people voted on, just not the ones the score ordering
    // keeps at the top — and the random seed word is the backstop for when the
    // pool is too small to have a tail worth reaching.
    if (explore) {
      const offset = exploreOffset(wide ? 48 : 24);
      let found = await fromPlatform({ offset });
      if (found.length < 4) found = [...found, ...(await searchFor(exploreSeed()))];
      // FLAT scoring, deliberately: ranking these by tasteScore would sort the
      // exploration back towards whatever the profile already likes, which is
      // the exact thing being escaped. The seen/disliked filter still applies —
      // exploring is not an excuse to replay something or to serve something
      // this browser has explicitly thumbed down.
      const scored = scoreCandidates(found, usable, () => 0);
      return { scored, seenRate: seenRate(), explored: true };
    }

    // Channels and the pool answer fast and are the good candidates; search is
    // the fallback and only worth waiting for if they came back thin. A cold
    // fill needs the breadth, so it asks for all three at once.
    const raw = (await Promise.all([fromChannels(), fromPlatform()])).flat();
    // WHAT YOU SAID PLUS WHAT YOU DID. tasteScore is the thumbs — deliberate,
    // sparse, and the strongest thing we have. retentionScore is how far
    // through you actually got — weak per video and noisy, but given on every
    // video rather than the handful anyone stops to rate, so over a session it
    // is the signal that actually accumulates. Added rather than blended:
    // retention's own weights are already scaled down (see retention.js), so a
    // thumb still outranks a run of finished videos.
    //
    // A thumbs-DOWN still wins outright: tasteScore returns -Infinity for one,
    // and no amount of having watched the thing changes that. Someone who
    // watched it all and then said no meant the no.
    const preference = (s) => tasteScore(s) + retentionScore(s);
    let scored = scoreCandidates(raw, usable, preference);
    if (scored.length < (wide ? POOL : 1)) {
      scored = dedupeScored([...scored, ...scoreCandidates(await fromSearch(), usable, preference)]);
    }
    // The head is exhausted — most of what came back has already been shown.
    // Re-ranking the same page again would just produce the same stragglers, so
    // go and get a page nobody has walked yet.
    if (seenRate() > 0.6) {
      const deeper = await fromPlatform({ offset: exploreOffset(wide ? 48 : 24) });
      scored = dedupeScored([...scored, ...scoreCandidates(deeper, usable, preference)])
        .sort((a, b) => b.value - a.value);
    }
    return { scored, seenRate: seenRate(), explored: false };
  }, []);

  /**
   * Pick the next thing to play after `current` — a weighted random draw over
   * the best candidates, so consecutive swipes go somewhere new.
   * @returns a player source, or null if nothing suitable turned up.
   */
  const pick = useCallback(async (current) => {
    remember(current);
    const explore = shouldExplore();
    let { scored, seenRate } = await candidatesFor(current, { explore });
    // An exploration that came back empty must not cost the swipe — the pool
    // may simply have no tail yet on a young platform. Fall back to the normal
    // path rather than handing the caller a null and stalling the feed.
    if (explore && !scored.length) ({ scored, seenRate } = await candidatesFor(current));
    const [choice] = draw(scored, 1, Math.random, poolFor(seenRate));
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
  const fill = useCallback(async (current, count = 6, { random = false } = {}) => {
    // RANDOM MODE — what an idle feed with no query should look like.
    //
    // The ranked path is seeded by taste, and a browser with no taste profile
    // yet has nothing to rank by: every weight is zero, so the draw collapses
    // onto the head of `trending` (ORDER BY score DESC) and hands back the same
    // few clips on every launch. That is the reported "fixed 6 or 8 results
    // that are always first" — not a cache, just a ranking with nothing to say.
    //
    // Exploration already exists for precisely this shape of problem (a random
    // depth into the pool, a random seed word, scored flat), so opening with no
    // query uses it wholesale rather than as the usual one-in-five garnish.
    if (random) {
      const { scored: wild, seenRate: wildRate } = await candidatesFor(current, { wide: true, explore: true });
      const picked = draw(wild, count, Math.random, poolFor(wildRate));
      if (picked.length) {
        markAllSeen(picked);
        return picked;
      }
      // A young pool can have no tail to reach into. Falling through to the
      // ranked path is better than handing back an empty feed.
    }

    const { scored, seenRate } = await candidatesFor(current, { wide: true });
    // A queue gets its exploration by construction rather than by coin-flip: a
    // batch of six drawn at a 1-in-5 rate could easily come back with none, and
    // the launch queue is exactly where a browser stuck in a basin most needs
    // something it would not have picked for itself.
    const want = Math.max(0, Math.round(count * EXPLORE_RATE));
    const chosen = draw(scored, count - want, Math.random, poolFor(seenRate));
    if (want > 0) {
      const { scored: wild } = await candidatesFor(current, { wide: true, explore: true });
      const keys = new Set(chosen.map((s) => mediaKey(s)));
      const fresh = draw(wild.filter((e) => !keys.has(mediaKey(e.s))), want);
      chosen.push(...fresh);
    }
    // Short of the ask because exploration had nothing to add — top back up
    // from the ranked list rather than returning a shorter queue.
    if (chosen.length < count) {
      const keys = new Set(chosen.map((s) => mediaKey(s)));
      chosen.push(...draw(
        scored.filter((e) => !keys.has(mediaKey(e.s))),
        count - chosen.length, Math.random, poolFor(seenRate),
      ));
    }
    markAllSeen(chosen);
    return chosen;
  }, [candidatesFor]);

  // Stable identity: callers put this in useCallback dependency lists, and a
  // fresh object every render would rebuild advance() (and re-run the effects
  // that depend on it) on every single keystroke elsewhere in the tree.
  return useMemo(() => ({ pick, fill, remember }), [pick, fill, remember]);
}

export default useUpNext;
