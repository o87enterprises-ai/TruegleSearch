/**
 * Similar artists, for the player's Radio switch.
 *
 * "Play more like this" has to mean similar MUSIC, not similar TITLES — the
 * plain up-next path searches the current title, which is how a song turned
 * into a run of covers, lyric videos and reaction clips of the same song.
 *
 * Two sources, tried in this order:
 *   1. LAST.FM, when LASTFM_API_KEY is set (free key; owner, 2026-10-17). One
 *      call — artist.getSimilar — and the best match data of the lot, built on
 *      years of what people actually scrobble together. No name lookup needed.
 *   2. LISTENBRAINZ, keyless and open, as the default and the fallback:
 *      MusicBrainz (artist name → MBID), then ListenBrainz labs (MBID →
 *      artists people listen to in the same sessions).
 * Both are co-listening, not audio analysis; it is how most "radio" features
 * work, and it lands on music that sounds alike far more often than any title
 * match does. A missing key, a Last.fm error or an artist it has never heard of
 * all fall through to ListenBrainz — Radio never depends on the key.
 *
 * MusicBrainz allows ONE request per second per client and asks for a
 * User-Agent naming the app and a contact. Lookups are therefore serialised
 * and spaced, and every answer — including "no idea" — is cached for a day, so
 * a radio session asks about each artist once.
 *
 * FAILS OPEN: any error returns []. Radio then falls back to the ordinary
 * up-next path, which is worse but never silent.
 */
const axios = require('axios');

const UA = 'TruegleSearch/1.0 ( https://truegle.info )';
const MB = 'https://musicbrainz.org/ws/2/artist';
const LB = 'https://labs.api.listenbrainz.org/similar-artists/json';
const LASTFM = 'https://ws.audioscrobbler.com/2.0/';
// ListenBrainz labs names its model in the URL; this is the one its own
// "similar artists" page uses.
const ALGORITHM = 'session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30';

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 1000;
const MB_GAP_MS = 1100;
const TIMEOUT_MS = 6000;

const cache = new Map(); // key → { at, value }
let mbQueue = Promise.resolve();
let mbLast = 0;

const norm = (name) => String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();

function remember(key, value) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** MusicBrainz, one at a time and at most once a second. */
function mbLookup(name) {
  const run = async () => {
    const wait = mbLast + MB_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    mbLast = Date.now();
    const { data } = await axios.get(MB, {
      params: { query: `artist:"${name.replace(/"/g, '')}"`, fmt: 'json', limit: 3 },
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT_MS,
    });
    // Only a confident match: a weak one would start a radio of the wrong band.
    const hit = (data?.artists || []).find((a) => Number(a.score) >= 90);
    return hit ? { mbid: hit.id, name: hit.name } : null;
  };
  const result = mbQueue.then(run, run);
  mbQueue = result.catch(() => {});
  return result;
}

/** Last.fm artist.getSimilar → { artist, similar } or null (no key / unknown / error). */
async function lastfmSimilar(artist, limit) {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;
  try {
    const { data } = await axios.get(LASTFM, {
      params: { method: 'artist.getsimilar', artist, api_key: key, format: 'json', limit: Math.min(limit * 2, 50), autocorrect: 1 },
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT_MS,
    });
    // Errors arrive as HTTP 200 with { error, message } (6 = artist not found).
    const rows = data && !data.error ? data.similarartists?.artist : null;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const similar = rows
      .sort((a, b) => (Number(b.match) || 0) - (Number(a.match) || 0))
      .map((a) => a && a.name)
      .filter((n, i, all) => n && all.indexOf(n) === i)
      .slice(0, limit);
    return similar.length ? { artist: data.similarartists['@attr']?.artist || artist, similar } : null;
  } catch {
    // The key is part of the failed request's URL, so the error is dropped, not logged.
    return null;
  }
}

/**
 * @param {string} artist  name as it appears on the playing item
 * @param {number} limit   how many similar artists to return
 * @returns {Promise<{artist: string|null, similar: string[]}>}
 */
async function similarArtists(artist, limit = 20) {
  const key = norm(artist);
  if (!key || key.length > 100) return { artist: null, similar: [] };
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const fm = await lastfmSimilar(artist, limit);
  if (fm) return remember(key, fm);

  try {
    const found = await mbLookup(artist);
    if (!found) return remember(key, { artist: null, similar: [] });
    const { data } = await axios.get(LB, {
      params: { artist_mbids: found.mbid, algorithm: ALGORITHM },
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT_MS,
    });
    const similar = (Array.isArray(data) ? data : [])
      .filter((a) => a && a.name && a.artist_mbid !== found.mbid)
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
      .map((a) => a.name)
      .filter((n, i, all) => all.indexOf(n) === i)
      .slice(0, limit);
    return remember(key, { artist: found.name, similar });
  } catch {
    // Not cached: a timeout or a busy MusicBrainz is worth asking again later.
    return { artist: null, similar: [] };
  }
}

// ── WHO RECORDED THIS? ───────────────────────────────────────────────────────
// Radio reads the artist off the title ("Artist - Song") or the channel
// ("Artist - Topic", "ArtistVEVO"). A title like "Song Name (Lyrics)" carries
// neither, and Radio used to give up there. This asks MusicBrainz's recording
// index for the title instead, through the same one-per-second queue, and
// accepts only a confident match. Cached a day, "no idea" included.
const TITLE_NOISE = /\[[^\]]*\]|\((?:official|lyrics?|audio|video|hd|hq|4k|visuali[sz]er|music video|lyric video|full song|live)[^)]*\)|\b(?:official (?:music )?video|official audio|lyrics?|lyric video|visuali[sz]er|hd|4k)\b|#\w+/gi;
const cleanTitle = (t) => String(t || '').replace(TITLE_NOISE, ' ').replace(/[|•·]+.*$/, ' ').replace(/\s+/g, ' ').trim();

async function artistForTitle(title) {
  const q = cleanTitle(title);
  if (q.length < 2 || q.length > 120) return { artist: null };
  const key = `title:${norm(q)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const run = async () => {
    const wait = mbLast + MB_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    mbLast = Date.now();
    const { data } = await axios.get('https://musicbrainz.org/ws/2/recording', {
      params: { query: `recording:"${q.replace(/"/g, '')}"`, fmt: 'json', limit: 5 },
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT_MS,
    });
    // Only a near-certain hit: the most-scored recording, ≥ 95, with a credited artist.
    const rec = (data?.recordings || []).find((r) => Number(r.score) >= 95 && r['artist-credit']?.[0]?.name);
    return { artist: rec ? rec['artist-credit'][0].name : null };
  };
  try {
    const result = mbQueue.then(run, run);
    mbQueue = result.catch(() => {});
    return remember(key, await result);
  } catch {
    return { artist: null };
  }
}

module.exports = { similarArtists, artistForTitle, cleanTitle, _cache: cache };
