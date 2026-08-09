const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { query } = require('../db/connection');
const gateway = require('../services/YouTubeGateway');

/*
 * Creator hub — YouTube channel feed proxy.
 *
 * YouTube publishes a FREE, no-API-key RSS feed per channel with the latest
 * ~15 uploads (youtube.com/feeds/videos.xml?channel_id=...). The browser can't
 * fetch it directly (the feed sends no CORS headers), so we proxy + parse it
 * here and hand back a small JSON list. Cached in-memory to stay well under any
 * rate limits and keep creator pages fast. Zero cost, zero credentials.
 */

const cache = new Map(); // channelId -> { at, videos }
const TTL_MS = 30 * 60 * 1000; // 30 min

/*
 * Resolve a channel HANDLE (@name) to its channelId, then hand back that
 * channel's feed. Searching for a channel gives us a name, not a UC… id, and
 * YouTube's RSS only speaks ids — so this is the missing step between "I found
 * the channel" and "show me their videos, newest first".
 *
 * Keyless: the channel page carries its own id in the markup. Only the id is
 * taken from that page, matched against the exact UC-id shape, and nothing
 * else from the response is used or echoed.
 */
const handleCache = new Map(); // handle -> { at, channelId }
const HANDLE_RE = /^[A-Za-z0-9._-]{2,60}$/;

router.get('/resolve', async (req, res) => {
  const handle = String(req.query.handle || '').replace(/^@+/, '').trim();
  if (!HANDLE_RE.test(handle)) return res.status(400).json({ error: 'bad_handle' });

  const hit = handleCache.get(handle.toLowerCase());
  if (hit && Date.now() - hit.at < TTL_MS) return res.json({ channelId: hit.channelId });

  try {
    // Data API first: channels.list?forHandle costs ONE quota unit and is a
    // documented contract, unlike reading an id out of page markup.
    const viaApi = await resolveViaDataApi(handle);
    if (viaApi) {
      handleCache.set(handle.toLowerCase(), { at: Date.now(), channelId: viaApi });
      return res.json({ channelId: viaApi });
    }
    // Keyless: read the id out of the channel page. `direct` returns null
    // rather than the captcha page when YouTube blocks the datacenter IP, so a
    // block falls through to the front-end pool instead of being parsed as
    // "this handle doesn't exist".
    const html = await gateway.direct(`https://www.youtube.com/@${encodeURIComponent(handle)}`);
    const id = html
      ? (/"channelId":"(UC[A-Za-z0-9_-]{20,30})"/.exec(html)
        || /channel\/(UC[A-Za-z0-9_-]{20,30})/.exec(html))?.[1]
      : await gateway.resolveHandle(handle);
    if (!id) return res.status(404).json({ error: 'not_found' });
    handleCache.set(handle.toLowerCase(), { at: Date.now(), channelId: id });
    return res.json({ channelId: id });
  } catch (err) {
    logger.warn('Handle resolve failed:', { handle, error: err.message });
    if (hit) return res.json({ channelId: hit.channelId, stale: true });
    return res.status(502).json({ error: 'resolve_failed' });
  }
});

/*
 * Channel ABOUT — name, bio and avatar for the creator card.
 *
 * channels.list?part=snippet costs ONE quota unit (search.list costs 100), so
 * this is affordable per page view even before the 6-hour cache. Without a key
 * it falls back to the channel page's own OpenGraph tags, which carry the same
 * three fields and need no credentials — the creator card should not go blank
 * just because a key is missing.
 */
const aboutCache = new Map(); // channelId -> { at, about }
const ABOUT_TTL_MS = 6 * 60 * 60 * 1000;

router.get('/:channelId/about', async (req, res) => {
  const { channelId } = req.params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(channelId)) return res.status(400).json({ error: 'bad_channel_id' });

  const hit = aboutCache.get(channelId);
  if (hit && Date.now() - hit.at < ABOUT_TTL_MS) return res.json(hit.about);

  try {
    let about = await aboutViaDataApi(channelId);
    if (!about) about = await aboutViaChannelPage(channelId);
    if (!about) throw new Error('no about');
    aboutCache.set(channelId, { at: Date.now(), about });
    return res.json(about);
  } catch (err) {
    logger.warn('Channel about failed:', { channelId, error: err.message });
    // Stale beats blank on a card that is mostly decoration.
    if (hit) return res.json({ ...hit.about, stale: true });
    return res.status(502).json({ error: 'about_failed' });
  }
});

async function aboutViaDataApi(channelId) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const url = 'https://www.googleapis.com/youtube/v3/channels'
      + `?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const item = (await r.json())?.items?.[0];
    if (!item) return null;
    const t = item.snippet?.thumbnails || {};
    return {
      channelId,
      name: item.snippet?.title || null,
      bio: (item.snippet?.description || '').slice(0, 600) || null,
      avatar: (t.high || t.medium || t.default || {}).url || null,
      handle: item.snippet?.customUrl ? `@${item.snippet.customUrl.replace(/^@/, '')}` : null,
      subscribers: item.statistics?.hiddenSubscriberCount ? null : (item.statistics?.subscriberCount || null),
      source: 'api',
    };
  } catch {
    return null;
  }
}

// Keyless fallback: the channel page's own OpenGraph tags. Only these three
// values are read, and nothing from the page is echoed back verbatim beyond
// them — same rule as the id scrape in /resolve.
async function aboutViaChannelPage(channelId) {
  const html = await gateway.direct(`https://www.youtube.com/channel/${encodeURIComponent(channelId)}`);
  // Blocked or gone. The front-end pool carries the same three fields as
  // structured JSON, so a captcha on our IP no longer blanks the creator card.
  if (!html) return gateway.channelAbout(channelId);
  const meta = (prop) => new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(html)?.[1] || null;
  const decode = (v) => (v ? v.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>') : null);
  const name = decode(meta('og:title'));
  // A page with no og:title is an interstitial we didn't pattern-match. Same
  // treatment as an outright block.
  if (!name) return gateway.channelAbout(channelId);
  return {
    channelId,
    name,
    bio: (decode(meta('og:description')) || '').slice(0, 600) || null,
    avatar: meta('og:image'),
    handle: null,
    subscribers: null,
    source: 'page',
  };
}

router.get('/:channelId/videos', async (req, res) => {
  const { channelId } = req.params;
  // YouTube channel IDs are "UC" + 22 url-safe chars; validate defensively.
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(channelId)) {
    return res.status(400).json({ error: 'invalid_channel', videos: [] });
  }

  const hit = cache.get(channelId);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return res.json({ videos: hit.videos, cached: true });
  }

  try {
    // Prefer the YouTube Data API when a key is configured — it's reliable from
    // datacenter IPs (Vercel), unlike the RSS feed which YouTube rate-limits
    // hard from cloud hosts. Falls back to RSS (with a browser UA) otherwise.
    let videos = null;
    try { videos = await fetchViaDataApi(channelId); } catch (e) {
      logger.warn('Creator Data API failed, trying RSS:', { channelId, error: e.message });
    }
    if (!videos || videos.length === 0) videos = await fetchViaRss(channelId);
    cache.set(channelId, { at: Date.now(), videos });
    return res.json({ videos });
  } catch (err) {
    logger.warn('Creator video fetch failed:', { channelId, error: err.message });
    if (hit) return res.json({ videos: hit.videos, stale: true }); // serve stale on error
    return res.status(502).json({ error: 'rss_unavailable', videos: [] });
  }
});

// The browser UA (and the consent cookie, and the optional proxy agent) moved
// into YouTubeGateway with the requests that needed them.

// Reliable path: YouTube Data API v3 playlistItems on the channel's uploads
// playlist (uploads id = channel id with the "UC" prefix swapped to "UU").
// 1 quota unit/call — negligible against the 10k/day free quota. Returns null
// when no key is set so the caller falls back to RSS.
async function fetchViaDataApi(channelId) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const uploads = `UU${channelId.slice(2)}`;
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${uploads}&key=${key}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`DataAPI ${r.status}`);
  const j = await r.json();
  return (j.items || []).map((it) => {
    const s = it.snippet || {};
    const videoId = s.resourceId?.videoId;
    if (!videoId) return null;
    const thumb =
      s.thumbnails?.high?.url || s.thumbnails?.medium?.url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return {
      videoId,
      title: s.title || '',
      published: s.publishedAt || null,
      thumbnail: thumb,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }).filter(Boolean);
}

// channels.list?forHandle — 1 quota unit. Returns null with no key set, so
// the caller falls back to reading the channel page.
async function resolveViaDataApi(handle) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(`@${handle}`)}&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const id = j.items?.[0]?.id;
    return /^UC[A-Za-z0-9_-]{20,30}$/.test(id || '') ? id : null;
  } catch {
    return null;
  }
}

/*
 * YouTube search, for when the web index can't answer a "find me this video"
 * question — which is most of the time, since it indexes pages about videos
 * rather than the videos themselves.
 *
 * QUOTA IS THE CONSTRAINT, not the code: search.list costs 100 units against a
 * 10,000/day free allowance, i.e. ~100 searches a day for the whole site. So
 * this is NOT the front door — the frontend calls it only when its normal
 * search comes back with nothing playable — and every query is cached for an
 * hour so a repeated search costs nothing.
 */
const searchCache = new Map(); // q -> { at, videos }
const SEARCH_TTL_MS = 60 * 60 * 1000;

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 120);
  if (q.length < 2) return res.status(400).json({ error: 'bad_query', videos: [] });

  const cached = searchCache.get(q.toLowerCase());
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) {
    return res.json({ videos: cached.videos, cached: true });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.json({ videos: [], unavailable: true });

  try {
    const url = 'https://www.googleapis.com/youtube/v3/search'
      + `?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(q)}&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`search ${r.status}`);
    const j = await r.json();
    const videos = (j.items || []).map((it) => {
      const id = it.id?.videoId;
      const sn = it.snippet || {};
      if (!id) return null;
      return {
        videoId: id,
        title: sn.title || '',
        channel: sn.channelTitle || '',
        published: sn.publishedAt || null,
        thumbnail: sn.thumbnails?.high?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    }).filter(Boolean);
    searchCache.set(q.toLowerCase(), { at: Date.now(), videos });
    return res.json({ videos });
  } catch (err) {
    logger.warn('YouTube search failed:', { q, error: err.message });
    // Quota exhaustion lands here too; an empty list degrades to the web
    // results the caller already has.
    return res.json({ videos: [], unavailable: true });
  }
});

/**
 * Uploads without a key. Direct RSS first — it is tolerant and cheap — and the
 * rotating Invidious pool underneath it, so a captcha on our IP costs a
 * different front-end's IP instead of an empty creator page.
 */
async function fetchViaRss(channelId) {
  const hit = await gateway.channelUploads(channelId);
  if (!hit) throw new Error('RSS unavailable and no front-end answered');
  if (hit.kind === 'rss') return parseFeed(hit.data).slice(0, 12);

  // Invidious shape → the same {videoId,title,published,thumbnail,url} the RSS
  // parser produces, so callers and the cache never learn which path answered.
  return hit.data.slice(0, 12).map((v) => ({
    videoId: v.videoId,
    title: v.title || '',
    published: v.published ? new Date(v.published * 1000).toISOString() : null,
    thumbnail: (Array.isArray(v.videoThumbnails) && v.videoThumbnails[0]?.url)
      || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${v.videoId}`,
  })).filter((v) => v.videoId);
}

/*
 * Referral attribution for the featured-creator rotation. A visit tagged to a
 * creator (either ?ref=<code> on any page, or a visit to their /creator page)
 * increments that code's daily counter. Fails soft — if the table isn't there
 * yet (migration 016 not run) or the DB is down, the frontend just falls back
 * to the static featured pick.
 */
router.post('/ref/:code', async (req, res) => {
  const { code } = req.params;
  if (!/^[a-z0-9-]{2,40}$/.test(code)) return res.status(400).json({ ok: false });
  try {
    await query(
      `INSERT INTO creator_ref_daily (ref_code, day, hits)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (ref_code, day)
       DO UPDATE SET hits = creator_ref_daily.hits + 1`,
      [code]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.warn('creator ref record failed:', { code, error: err.message });
    res.json({ ok: false }); // non-fatal
  }
});

// The current featured creator = most attributed traffic over the last 7 days.
router.get('/featured', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT ref_code FROM creator_ref_daily
       WHERE day >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY ref_code
       ORDER BY SUM(hits) DESC
       LIMIT 1`
    );
    res.json({ refCode: rows[0]?.ref_code || null });
  } catch (err) {
    logger.warn('creator featured lookup failed:', { error: err.message });
    res.json({ refCode: null }); // frontend falls back to static featured
  }
});

function parseFeed(xml) {
  return xml.split('<entry>').slice(1).map((e) => {
    const videoId = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    if (!videoId) return null;
    const title = decode((e.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || null;
    const thumbnail =
      (e.match(/<media:thumbnail\s+url="([^"]+)"/) || [])[1] ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return {
      videoId,
      title,
      published,
      thumbnail,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }).filter(Boolean);
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

module.exports = router;
