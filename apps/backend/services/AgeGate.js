// Which of these YouTube videos does YouTube ITSELF mark 18+?
//
// Owner, 2026-10-13: a song should play under Safe Search "unless the song link
// is explicitly an 18+ gated YouTube video". "Explicitly gated" has an official
// answer: the Data API reports `contentDetails.contentRating.ytRating` as
// "ytAgeRestricted" for exactly the videos YouTube puts behind its own age
// check. That is YouTube's decision, not ours — Truegle does not guess at it
// from a title.
//
// COST. videos.list is ONE quota unit for up to 50 ids, against an allowance of
// 10,000/day shared by the whole site (a YouTube SEARCH is 100). Answers are
// remembered per video for a day, so a popular song costs one unit a day, not
// one per search.
//
// FAILS OPEN, ON PURPOSE. No API key, a quota error, a timeout: nothing is
// hidden. Hiding every video because the check was unavailable would turn a
// quota blip into "Safe Search found no music", the exact complaint this exists
// to fix. It is safe to fail open for a second reason: an age-restricted video
// cannot play in an anonymous embed anyway — YouTube asks for a sign-in — so one
// that slips through shows its own age prompt rather than playing.
const logger = require('../utils/logger');

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 5000;
const cache = new Map(); // id -> { at, restricted }

const ID = /^[\w-]{11}$/;
const idOf = (url) => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1, 12);
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch { /* not a URL */ }
  return null;
};

/**
 * @param {string[]} ids YouTube video ids
 * @param {{ fetchImpl?: Function, apiKey?: string }} [opts] injectable for tests
 * @returns {Promise<Set<string>>} the ids YouTube marks age-restricted. Never throws.
 */
async function ageRestrictedIds(ids, { fetchImpl = globalThis.fetch, apiKey = process.env.YOUTUBE_API_KEY } = {}) {
  const wanted = [...new Set((ids || []).filter((i) => ID.test(i || '')))];
  const out = new Set();
  if (!wanted.length) return out;
  const now = Date.now();
  const missing = [];
  for (const id of wanted) {
    const hit = cache.get(id);
    if (hit && now - hit.at < TTL_MS) { if (hit.restricted) out.add(id); } else missing.push(id);
  }
  if (!missing.length || !apiKey || typeof fetchImpl !== 'function') return out;

  try {
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      const res = await fetchImpl(
        'https://www.googleapis.com/youtube/v3/videos?part=contentDetails'
        + `&id=${batch.join(',')}&key=${apiKey}`,
        { signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) throw new Error(`videos.list ${res.status}`);
      const data = await res.json();
      const answered = new Set();
      for (const item of data.items || []) {
        const restricted = item?.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted';
        answered.add(item.id);
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
        cache.set(item.id, { at: now, restricted });
        if (restricted) out.add(item.id);
      }
      // A video the API did not return is private/deleted — nothing to gate,
      // and not worth asking about again today.
      for (const id of batch) if (!answered.has(id)) cache.set(id, { at: now, restricted: false });
    }
  } catch (err) {
    logger.warn('Age-gate check failed — failing open', { error: err && err.message });
  }
  return out;
}

const clearAgeGateCache = () => cache.clear();

module.exports = { ageRestrictedIds, idOf, clearAgeGateCache };
