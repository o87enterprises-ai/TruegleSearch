import { getPlayable, mediaKey } from './videoEmbed';
import { shortFormPlatform, parseDurationSeconds, REEL_MAX_SECONDS } from './shortForm';
import { likedWords, likedChannels, isDisliked } from './taste';
import { hasSeen, markAllSeen } from './seen';
import { metaFor } from './mediaMeta';

// WHAT MAY APPEAR IN REELS, and where reels come from.
//
// Reels is its own feed, distinct from Tube: vertical short-form ONLY — a
// YouTube Short or a TikTok (owner, 2026-09-28). Tube may still play a Short,
// just as YouTube does; Reels never shows a landscape upload.
//
// A YOUTUBE CLIP IS PROVEN A SHORT, not guessed. A "#shorts" tag and a short
// running time are what an uploader SAYS; YouTube's own oEmbed answers a
// /shorts/ URL with portrait dimensions only for a real Short. That lookup
// goes through our backend (/api/media/titles), so YouTube never sees which
// candidates a visitor was shown. Proven Shorts may run to YouTube's own 3:00
// limit. If the backend can't answer with dimensions, the old guess stands
// but at the stricter 2:00 + tagged rule.
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

const YT_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([\w-]{11})/i;
const SHORTS_TAG = /#shorts?\b/i;
const UNPROVEN_MAX_SECONDS = 120;

/**
 * Web rows → YouTube Shorts, keeping only what YouTube itself says is one.
 * Candidates: any YouTube video known to run ≤3:00, or tagged #shorts.
 * Exported for the test.
 */
export async function provenShorts(rows, signal) {
  const cands = [];
  const seenIds = new Set();
  for (const r of rows) {
    const id = YT_ID.exec(r?.url || '')?.[1];
    if (!id || seenIds.has(id)) continue;
    const secs = parseDurationSeconds(r.duration);
    const tagged = SHORTS_TAG.test(`${r.title || ''} ${r.snippet || ''}`);
    const alreadyShorts = /\/shorts\//.test(r.url);
    if (secs != null && secs > REEL_MAX_SECONDS) continue;
    if (secs == null && !tagged && !alreadyShorts) continue;
    seenIds.add(id);
    cands.push({ r, id, secs, tagged, url: `https://www.youtube.com/shorts/${id}` });
  }
  if (!cands.length) return [];

  // One ask, up to 25 — the route's own ceiling.
  const list = cands.slice(0, 25);
  const answer = await post('/api/media/titles', { urls: list.map((c) => c.url) }, signal);
  const titles = answer?.titles || {};
  const proven = Object.values(titles).some((t) => t && Number(t.width) > 0);

  return list.map((c) => {
    const t = titles[c.url];
    const ok = proven
      ? !!t && Number(t.height) > Number(t.width)
      : c.tagged && c.secs != null && c.secs > 0 && c.secs <= UNPROVEN_MAX_SECONDS;
    if (!ok) return null;
    return toSource({
      url: c.url,
      title: c.r.title || t?.title,
      thumbnail: c.r.image || c.r.thumbnail,
      channel: c.r.channel || c.r.author || t?.author,
      duration: c.r.duration,
    });
  }).filter(Boolean);
}

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

  const fromWeb = await provenShorts(web?.results || [], signal);
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
