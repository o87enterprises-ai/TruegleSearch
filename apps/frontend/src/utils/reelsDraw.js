import { getPlayable, mediaKey } from './videoEmbed';
import { asReel, isShortForm, shortFormPlatform, parseDurationSeconds, REEL_MAX_SECONDS } from './shortForm';
import { likedWords, likedChannels, isDisliked } from './taste';
import { hasSeen, markAllSeen } from './seen';
import { metaFor } from './mediaMeta';

// WHAT MAY APPEAR IN REELS, and where reels come from.
//
// Reels is its own feed, distinct from Tube: vertical short-form ONLY — a
// YouTube Short or a TikTok, 2:00 or less (owner, 2026-09-28). Tube may still
// play a Short, just as YouTube does; Reels never shows a landscape upload.
//
// This used to draw its swipe-next and its endless top-up from useUpNext, the
// Tube pool, which has no notion of "short" at all — that is how widescreen
// videos reached the reel player. Every row here passes isReelSource().
//
// TWO FREE SOURCES, both already behind our own backend (no key, no spend):
//   • the video index, asked for "<seed> #shorts" — tagged, timed YouTube
//     Shorts that asReel() promotes to their /shorts/ form;
//   • the feed's TikTok lane, asked for "<seed>".

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Only what plays inline AND is shot vertically. Instagram/Facebook reels are
// short-form but link-out only, so they never reach a player.
const PLAYABLE_PLATFORMS = new Set(['YouTube Shorts', 'TikTok']);

/** A player source that belongs in Reels. Pure — exported for the test. */
export function isReelSource(s) {
  if (!s?.src) return false;
  const link = s.pageUrl || s.url;
  if (!PLAYABLE_PLATFORMS.has(shortFormPlatform(link))) return false;
  // Length: what the row says, else what an embed told us earlier.
  const told = parseDurationSeconds(s.duration);
  const learned = metaFor(s)?.d;
  const secs = told ?? learned ?? null;
  return secs == null || secs <= REEL_MAX_SECONDS;
}

// Seeds for a feed with no subject: things people actually make shorts of.
export const REEL_SEEDS = [
  'funny', 'satisfying', 'animals', 'cooking', 'skateboarding', 'magic trick',
  'dance', 'street food', 'comedy skit', 'music cover', 'art timelapse',
  'football skills', 'science experiment', 'travel', 'fails', 'life hack',
  'drumming', 'wildlife', 'parkour', 'pets',
];

/**
 * What to search when nobody typed anything — or when Shuffle is pressed.
 * Leans on this browser's thumbs (a liked word or channel) most of the time,
 * with a fixed share of seeds that ignore taste so the feed can leave the
 * neighbourhood it starts in.
 */
export function reelSeed(rand = Math.random) {
  const words = likedWords(8);
  const channels = likedChannels(4);
  const taste = [...words, ...channels];
  if (taste.length && rand() >= 0.3) return taste[Math.floor(rand() * taste.length) % taste.length];
  return REEL_SEEDS[Math.floor(rand() * REEL_SEEDS.length) % REEL_SEEDS.length];
}

const toSource = ({ url, title, thumbnail, channel, duration }) => {
  const p = getPlayable(url);
  if (!p) return null;
  return {
    ...p,
    vertical: true,
    title: title || url,
    pageUrl: url,
    poster: thumbnail || null,
    channel: channel || undefined,
    duration: duration ?? undefined,
  };
};

function shuffled(rows, rand = Math.random) {
  const out = [...rows];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const post = (path, body, signal) => fetch(`${BACKEND}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal,
}).then((r) => (r.ok ? r.json() : null)).catch((e) => { if (e?.name === 'AbortError') throw e; return null; });

/**
 * One batch of reels for `seed`. `page` walks the video index deeper for
 * "more"; `exclude` is the keys already on screen.
 * @returns {Promise<object[]>} player sources, all passing isReelSource.
 */
export async function drawReels(seed, { page = 1, exclude = new Set(), signal } = {}) {
  const q = String(seed || '').trim() || reelSeed();
  const [web, tiktok] = await Promise.all([
    post('/api/search', {
      query: `${q} #shorts`,
      filters: { category: 'videos', bias: 'all', dateRange: 'any', perPage: 20, page },
    }, signal),
    // The TikTok lane has no pages to walk, so only the first page asks it.
    page === 1
      ? post('/api/social/feed', { query: q, platforms: ['tiktok'], limit: 20, cursor: {} }, signal)
      : Promise.resolve(null),
  ]);

  const fromWeb = (web?.results || []).map((r) => {
    const reel = asReel({ url: r.url, title: r.title, snippet: r.snippet, duration: r.duration });
    if (!reel || !isShortForm(reel)) return null;
    return toSource({
      url: reel.url, title: r.title, thumbnail: r.image || r.thumbnail, channel: r.channel || r.author, duration: r.duration,
    });
  });
  const fromTikTok = (tiktok?.results || []).map((r) => toSource({
    url: r.permalink || r.url, title: r.title, thumbnail: r.thumbnail, channel: r.author,
  }));

  const keys = new Set(exclude);
  const rows = [];
  for (const s of shuffled([...fromWeb, ...fromTikTok].filter(Boolean))) {
    const k = mediaKey(s);
    if (!k || keys.has(k) || !isReelSource(s) || isDisliked(s)) continue;
    keys.add(k);
    rows.push(s);
  }
  // Unseen first; seen ones only fill in behind, so a narrow topic still
  // gives a feed rather than an empty screen.
  const fresh = rows.filter((s) => !hasSeen(mediaKey(s)));
  const out = [...fresh, ...rows.filter((s) => hasSeen(mediaKey(s)))];
  markAllSeen(fresh);
  return out;
}
