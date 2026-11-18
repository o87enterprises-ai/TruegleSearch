/**
 * Keyless search adapters (no API key, no account, no SearXNG, nothing on the EC2 box).
 *
 * Each adapter is `async (query, { limit, safe }) => item[]` and returns items in
 * the SAME shape SearchService already produces for SearXNG videos/social, so they
 * merge with every other source. They THROW on transport trouble (timeout, 429, 5xx)
 * so the pool can cool the provider down; "no results" is an empty array, NOT an error.
 *
 * Field names were read from real responses (2026-11-12), see __tests__/fixtures/openSearch.
 *
 * PRIVACY: requests leave from our server only. No user IP, cookie or header is
 * forwarded; the User-Agent is the same backend UA SearXNG calls already use.
 */
const axios = require('axios');

const TIMEOUT_MS = 5000;
const HEADERS = { 'User-Agent': 'TruegleSearch/1.0 (+https://truegle.info)', Accept: 'application/json' };

const get = async (url, params, timeout = TIMEOUT_MS) => (await axios.get(url, { params, headers: HEADERS, timeout })).data;

const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const stripHtml = (s) => String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const iso = (v) => { const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };

/** 352 -> "5:52", 3725 -> "1:02:05" (the format SearXNG's `length` already uses). */
function clock(seconds) {
  const s = Math.round(Number(seconds));
  if (!Number.isFinite(s) || s <= 0) return null;
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

const base = (o) => ({
  snippet: '', date: null, favicon: null, verified: true, image: null, thumbnail: null,
  iframeSrc: null, duration: null, videoId: null, ...o, domain: domainOf(o.url),
});

// ---------------------------------------------------------------- VIDEO
async function sepia(q, { limit = 10, safe = true, timeoutMs } = {}) {
  // Sepia Search = the PeerTube project's federated index (hundreds of instances).
  const d = await get('https://sepiasearch.org/api/v1/search/videos', { search: q, count: limit, nsfw: safe ? 'false' : 'both' }, timeoutMs);
  return (d.data || []).filter((v) => v.url && v.name && !(safe && v.nsfw)).map((v) => base({
    title: v.name, url: v.url, snippet: clip(stripHtml(v.truncatedDescription || v.description), 280),
    source: 'sepia', sourceName: `${v.channel?.displayName || v.account?.displayName || 'PeerTube'} · PeerTube`,
    date: iso(v.publishedAt), image: v.thumbnailUrl || null, thumbnail: v.thumbnailUrl || null,
    iframeSrc: v.embedUrl || null, duration: v.isLive ? null : clock(v.duration), category: 'videos',
  }));
}

async function dailymotion(q, { limit = 10, safe = true, timeoutMs } = {}) {
  const d = await get('https://api.dailymotion.com/videos', {
    search: q, limit, family_filter: safe ? 'true' : 'false',
    fields: 'id,title,url,thumbnail_360_url,duration,created_time,owner.screenname,description,embed_url',
  }, timeoutMs);
  return (d.list || []).filter((v) => v.url && v.title).map((v) => base({
    title: v.title, url: v.url, snippet: clip(stripHtml(v.description), 280),
    source: 'dailymotion', sourceName: `${v['owner.screenname'] || 'Dailymotion'} · Dailymotion`,
    date: iso(v.created_time), image: v.thumbnail_360_url || null, thumbnail: v.thumbnail_360_url || null,
    iframeSrc: v.embed_url || null, duration: clock(v.duration), category: 'videos',
  }));
}

// ---------------------------------------------------------------- AUDIO
async function audius(q, { limit = 10, timeoutMs } = {}) {
  const d = await get('https://api.audius.co/v1/tracks/search', { query: q, limit, app_name: 'truegle' }, timeoutMs);
  return (d.data || []).filter((t) => t.permalink && t.title).map((t) => base({
    title: t.title, url: `https://audius.co${t.permalink}`, snippet: clip(stripHtml(t.description), 280),
    source: 'audius', sourceName: `${t.user?.name || 'Audius'} · Audius`, date: iso(t.release_date),
    image: t.artwork?.['480x480'] || null, thumbnail: t.artwork?.['150x150'] || null,
    duration: clock(t.duration), category: 'audio',
  }));
}

async function openverseAudio(q, { limit = 10, safe = true, timeoutMs } = {}) {
  const d = await get('https://api.openverse.org/v1/audio/', { q, page_size: limit, mature: safe ? 'false' : 'true' }, timeoutMs);
  return (d.results || []).filter((a) => a.foreign_landing_url && a.title && !(safe && a.mature)).map((a) => base({
    title: a.title, url: a.foreign_landing_url, snippet: `${a.creator ? `By ${a.creator}. ` : ''}License: CC ${String(a.license || '').toUpperCase()}`.trim(),
    source: 'openverse', sourceName: `${a.provider || 'Openverse'} · Openverse (CC)`, date: iso(a.indexed_on),
    image: a.thumbnail || null, thumbnail: a.thumbnail || null,
    duration: clock((a.duration || 0) / 1000), category: 'audio',
  }));
}

async function itunesPodcasts(q, { limit = 10, timeoutMs } = {}) {
  const d = await get('https://itunes.apple.com/search', { term: q, media: 'podcast', limit }, timeoutMs);
  return (d.results || []).filter((p) => (p.trackViewUrl || p.collectionViewUrl) && (p.collectionName || p.trackName)).map((p) => base({
    title: p.collectionName || p.trackName, url: p.trackViewUrl || p.collectionViewUrl,
    snippet: [p.artistName, p.primaryGenreName].filter(Boolean).join(' · '),
    source: 'itunes', sourceName: 'Podcasts · Apple directory', date: iso(p.releaseDate),
    image: p.artworkUrl600 || null, thumbnail: p.artworkUrl600 || null, category: 'audio',
  }));
}

async function internetArchive(q, { limit = 10, timeoutMs } = {}) {
  // Built by hand: axios would mangle the repeated `fl[]` key (it JSON-stringifies arrays under a key ending in []).
  const p = new URLSearchParams({ q: `(title:(${q}) OR subject:(${q})) AND mediatype:(audio OR movies)`, rows: String(limit), output: 'json' });
  ['identifier', 'title', 'mediatype', 'publicdate', 'description'].forEach((f) => p.append('fl[]', f));
  const d = await get(`https://archive.org/advancedsearch.php?${p}`, undefined, timeoutMs);
  return (d.response?.docs || []).filter((x) => x.identifier && x.title).map((x) => base({
    title: Array.isArray(x.title) ? x.title[0] : x.title, url: `https://archive.org/details/${x.identifier}`,
    snippet: clip(stripHtml(Array.isArray(x.description) ? x.description[0] : x.description), 280),
    source: 'archive', sourceName: 'Internet Archive', date: iso(x.publicdate),
    image: `https://archive.org/services/img/${x.identifier}`, thumbnail: `https://archive.org/services/img/${x.identifier}`,
    category: x.mediatype === 'movies' ? 'videos' : 'audio',
  }));
}

// --------------------------------------------------------------- SOCIAL
// lemmy.ml, not lemmy.world: measured 2026-11-12, same query took 1.4s vs 5.7-7s (lemmy.world / sh.itjust.works).
async function lemmy(q, { limit = 10, safe = true, timeoutMs } = {}) {
  const d = await get('https://lemmy.ml/api/v3/search', { q, type_: 'Posts', limit, sort: 'TopMonth' }, timeoutMs);
  return (d.posts || []).filter((p) => p.post && !p.post.deleted && !p.post.removed && !(safe && p.post.nsfw)).map((p) => base({
    title: p.post.name, url: p.post.ap_id || p.post.url, snippet: clip(stripHtml(p.post.body), 280),
    source: 'lemmy', sourceName: `c/${p.community?.name || 'lemmy'} · Lemmy · ${p.counts?.score ?? 0} points`,
    date: iso(p.post.published), image: p.post.thumbnail_url || null, thumbnail: p.post.thumbnail_url || null, category: 'social',
  }));
}

/** Mastodon search needs a login; the public HASHTAG timeline does not, so this runs for one-word queries only. */
async function mastodonTag(q, { limit = 10, safe = true, timeoutMs } = {}) {
  const tag = String(q || '').trim().replace(/^#/, '');
  if (!/^[\p{L}\p{N}_]{2,40}$/u.test(tag)) return []; // not a hashtag-shaped query: nothing to do, not an error
  const d = await get(`https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(tag)}`, { limit }, timeoutMs);
  return (Array.isArray(d) ? d : []).filter((m) => (m.url || m.uri) && !(safe && m.sensitive)).map((m) => {
    const text = stripHtml(m.content);
    const img = (m.media_attachments || []).find((a) => a.type === 'image')?.preview_url || null;
    return base({
      title: clip(text, 110) || `Post by ${m.account?.acct}`, url: m.url || m.uri, snippet: clip(text, 280),
      source: 'mastodon', sourceName: `${m.account?.display_name || m.account?.acct || 'Mastodon'} · Mastodon`,
      date: iso(m.created_at), image: img, thumbnail: img, category: 'social',
    });
  });
}

module.exports = { sepia, dailymotion, audius, openverseAudio, itunesPodcasts, internetArchive, lemmy, mastodonTag, clock };
