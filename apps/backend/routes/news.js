/*
 * The landing page's news feed — local + global headlines, video coverage, and
 * a live markets summary.
 *
 * The upstream adapters live in services/NewsSources.js, which requires
 * NOTHING so that scripts/verify-news.mjs can check them on a machine where
 * `npm install` cannot complete. This file is the express + caching + video
 * layer on top of them.
 *
 * EVERY SOURCE IS FREE AND KEYLESS. That is a hard requirement, not a
 * preference (the $0 budget), so:
 *
 *   print    -> Google News RSS. Country-scoped editions are a URL parameter,
 *              which is what makes "local" work without asking anyone where
 *              they are.
 *   video    -> OUR OWN search (SearXNG), category `videos`, seeded with the
 *              day's top headline. Deliberately not a hardcoded list of news
 *              channels: picking which outlets count as "the news" is exactly
 *              the editorial thumb on the scale Truegle exists to avoid, and
 *              this way the video row is whatever the index actually has.
 *   markets  -> CoinGecko for crypto, Yahoo Finance for indices and
 *              commodities. Yahoo is UNOFFICIAL - see NewsSources.js.
 *
 * WHERE THE USER IS: the country comes from the edge/CDN header the request
 * already carries (GeoService.countryFromHeaders - Cloudflare and Vercel both
 * set it for free). No geolocation prompt, no IP lookup service, no third
 * party, and nothing is stored against anybody. The client may also pass
 * ?country= to override it, which is what the feed's own region picker sends.
 */
const express = require('express');

const router = express.Router();
const GeoService = require('../services/GeoService');
const logger = require('../utils/logger');
const { printHeadlines, markets, COUNTRY } = require('../services/NewsSources');

// -- cache -------------------------------------------------------------------
// One process-local Map, same as routes/creators.js. Serverless gives every
// instance its own, which is fine: the TTLs exist to stay well inside the free
// tiers' rate limits, and a cold instance making one extra call is not the
// thing that would breach them.
const cache = new Map(); // key -> { at, value }

const TTL = {
  print: 5 * 60 * 1000,        // headlines move, but not every second
  video: 15 * 60 * 1000,       // our own SearXNG - be kind to the box
  markets: 60 * 1000,          // "live" without hammering a free tier
};

async function cached(key, ttl, produce) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return { ...hit.value, cached: true };
  const value = await produce();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Serve whatever is in the cache regardless of age. The "better than nothing
 *  when an upstream is down" path - a stale headline beats an empty panel. */
function stale(key) {
  const hit = cache.get(key);
  return hit ? { ...hit.value, stale: true } : null;
}

// -- video: our own index ----------------------------------------------------
async function videoCoverage(seed) {
  // Required lazily: the search service pulls in a lot, and the markets-only
  // refresh path has no business paying for it.
  const PrivateSearchService = require('../services/PrivateSearchService');
  const query = (seed || 'world news today').slice(0, 120);
  const data = await PrivateSearchService.search(query, { category: 'videos', perPage: 12 });
  const rows = data?.results || data || [];
  const items = (Array.isArray(rows) ? rows : []).slice(0, 12).map((r) => ({
    title: r.title || '',
    url: r.url || r.pageUrl || '',
    source: r.engine || r.source || '',
    thumbnail: r.thumbnail || r.img_src || r.image || '',
    at: r.publishedDate ? Date.parse(r.publishedDate) || null : null,
  })).filter((v) => v.title && v.url);
  // Wrapped rather than returned bare: cached() stores objects so it can stamp
  // `cached`/`stale` onto what it hands back, and spreading an array turns it
  // into a keyed object with a length property - a silent, ugly failure.
  return { items };
}

// -- routes -─────────────────────────────────────────────────────────────────

/**
 * GET /api/news/feed?country=US
 *
 * The landing page's first paint. Every category is settled independently, so
 * a dead upstream costs one panel and not the feed.
 */
router.get('/feed', async (req, res) => {
  const country = COUNTRY.test(String(req.query.country || '').toUpperCase())
    ? String(req.query.country).toUpperCase()
    : (await GeoService.detectCountry(req).catch(() => null)) || 'US';

  const printKey = `print:${country}`;
  const [printed, market] = await Promise.allSettled([
    cached(printKey, TTL.print, () => printHeadlines(country)),
    cached('markets', TTL.markets, markets),
  ]);

  const print = printed.status === 'fulfilled'
    ? printed.value
    : stale(printKey) || { country, local: [], world: [] };

  // Video is seeded by the day's top headline, so it has to wait for print —
  // and it must never be the reason the feed is slow, hence its own cache key
  // and a shorter leash than the panels above it.
  const seed = print.local?.[0]?.title || print.world?.[0]?.title || '';
  const videoKey = `video:${country}`;
  let video = [];
  try {
    video = (await cached(videoKey, TTL.video, () => videoCoverage(seed))).items;
  } catch (err) {
    logger.warn('News video lookup failed:', { error: err.message });
    video = stale(videoKey)?.items || [];
  }

  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    country,
    print,
    video,
    markets: market.status === 'fulfilled' ? market.value : stale('markets') || { crypto: [], stocks: [], commodities: [] },
  });
});

/**
 * GET /api/news/markets
 *
 * Just the numbers. The markets panel refreshes on its own cadence and has no
 * use for a headline it already has — and when the panel is minimised the
 * client stops calling this entirely.
 */
router.get('/markets', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    res.json(await cached('markets', TTL.markets, markets));
  } catch (err) {
    logger.warn('Markets fetch failed:', { error: err.message });
    const last = stale('markets');
    if (last) return res.json(last);
    return res.status(502).json({ error: 'markets_unavailable', crypto: [], stocks: [], commodities: [] });
  }
});

module.exports = router;
