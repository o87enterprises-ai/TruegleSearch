// GET /api/embed/rumble?url=<rumble watch page> → { src }
//
// A Rumble watch page's id (rumble.com/v7hhvy2-title.html) is NOT its embed
// id: rumble.com/embed/v7hhvy2/ answers "Video not found" (owner's report,
// 2026-11-10). Rumble's keyless oEmbed returns the real embed iframe, so the
// player asks here and swaps it in. Only rumble.com pages are looked up, and
// only the page URL is sent; nothing about the visitor.
const express = require('express');
const axios = require('axios');

const router = express.Router();
const cache = new Map(); // page url → embed src (or null), process-local
const MAX_CACHE = 2000;

const isRumblePage = (raw) => {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    return u.protocol === 'https:' && host === 'rumble.com' && /^\/v[a-z0-9]+/i.test(u.pathname);
  } catch { return false; }
};

async function resolveRumble(url, { get = axios.get } = {}) {
  if (cache.has(url)) return cache.get(url);
  let src = null;
  try {
    const { data } = await get('https://rumble.com/api/Media/oembed.json', { params: { url }, timeout: 5000 });
    const m = /src="(https:\/\/rumble\.com\/embed\/[a-z0-9]+\/?[^"]*)"/i.exec(String(data?.html || ''));
    src = m ? m[1] : null;
  } catch { src = null; }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(url, src);
  return src;
}

router.get('/rumble', async (req, res) => {
  const url = String(req.query.url || '').slice(0, 500);
  if (!isRumblePage(url)) return res.status(400).json({ error: 'not a rumble.com video page' });
  const src = await resolveRumble(url);
  res.set('Cache-Control', 'public, max-age=86400');
  return res.json({ src });
});

module.exports = router;
module.exports.resolveRumble = resolveRumble;
module.exports.isRumblePage = isRumblePage;
module.exports.__cache = cache;
