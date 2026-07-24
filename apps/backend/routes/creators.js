const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

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
    const r = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      { headers: { 'User-Agent': 'TruegleCreatorHub/1.0' } }
    );
    if (!r.ok) throw new Error(`RSS ${r.status}`);
    const xml = await r.text();
    const videos = parseFeed(xml).slice(0, 12);
    cache.set(channelId, { at: Date.now(), videos });
    return res.json({ videos });
  } catch (err) {
    logger.warn('Creator RSS fetch failed:', { channelId, error: err.message });
    if (hit) return res.json({ videos: hit.videos, stale: true }); // serve stale on error
    return res.status(502).json({ error: 'rss_unavailable', videos: [] });
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
