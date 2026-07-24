const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { query } = require('../db/connection');

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
