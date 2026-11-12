// Scheduled jobs (Vercel Cron, see vercel.json "crons").
//
// GET /api/cron/refresh-top-feed — pre-build the landing page's top-posts feed
// once a day at 6:00 AM Pacific, so the first visitor of the day is served from
// the cache instead of waiting for the scrape (services/TopFeedCache.js).
//
// WHY TWO SCHEDULE ENTRIES: Vercel cron schedules are fixed UTC and know nothing
// of daylight saving. 6 AM Pacific is 13:00 UTC in summer and 14:00 UTC in
// winter, so both are scheduled and this handler does the work only when it is
// really the 6 o'clock hour in America/Los_Angeles; the other one answers
// "skipped". (On Vercel's Hobby plan a cron fires somewhere within its hour, so
// "6 AM" means the 6 o'clock hour there.)
//
// AUTH: if CRON_SECRET is set, Vercel sends it as `Authorization: Bearer …` and
// anything else is refused. If it is not set the endpoint still cannot be abused
// into extra work: it only acts in the 6 o'clock hour, and only when the current
// day's entry is not already built.
const crypto = require('crypto');
const express = require('express');
const logger = require('../utils/logger');
const TopFeedCache = require('../services/TopFeedCache');
const ContentLang = require('../services/ContentLang');
const { PREWARM_REQUEST, TOP_NETWORKS, pillRequest } = require('../config/topFeed');
const { isRefreshHour, epochId } = require('../utils/cacheEpoch');

const router = express.Router();

// After the landing page, each network's own pill is pre-built too, so picking
// Instagram or TikTok under Top is a cache hit instead of a live scrape (owner,
// 2026-11-10). They are cheap: the landing build has just filled the per-server
// guard (services/feed/ServerGuard.js), so these builds mostly read from it. They
// run one at a time and stop at a time budget, because the landing entry — the one
// that matters — is already stored by then.
const PILL_BUDGET_MS = 20 * 1000;
async function prewarmPills(build, { force, now }) {
  const started = Date.now();
  const out = {};
  for (const network of TOP_NETWORKS) {
    if (Date.now() - started > PILL_BUDGET_MS) { out[network] = 'skipped'; continue; }
    const req = pillRequest(network);
    try {
      out[network] = (await TopFeedCache.refreshOne(req, () => build(req), { force, now })).status;
    } catch (err) {
      out[network] = 'failed';
      logger.warn(`Pill refresh failed for ${network}:`, err.message);
    }
  }
  return out;
}

function checkAuth(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: true, strong: false };
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(String(req.get('authorization') || ''));
  const ok = got.length === want.length && crypto.timingSafeEqual(got, want);
  return { ok, strong: ok };
}

router.get('/refresh-top-feed', async (req, res) => {
  const auth = checkAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'unauthorised' });
  // Keep the free Hugging Face search-gateway Space awake (it sleeps after ~48h idle). Best-effort, <=3s,
  // instant no-op while SEARCH_GATEWAY_URL is unset.
  await require('../services/openSearch/gateway').ping();
  const force = req.query.force === '1';
  if (force && !auth.strong) return res.status(403).json({ error: 'force needs CRON_SECRET' });

  const now = Date.now();
  if (!force && !isRefreshHour(now)) {
    return res.json({ status: 'skipped', reason: 'not the 6 AM Pacific hour', epoch: epochId(now) });
  }
  try {
    const { buildFeedPayload } = require('./social');
    // Annotated with each post's language exactly as a visitor's build is.
    const build = async (r) => ContentLang.annotate(await buildFeedPayload({
      q: r.query, requestedPlatforms: r.platforms, cur: r.cursor, limit: r.limit, allowAdult: r.adult,
    }));
    const result = await TopFeedCache.refreshTop(() => build(PREWARM_REQUEST), { force, now });
    result.pills = await prewarmPills(build, { force, now });
    await TopFeedCache.prune();
    logger.info('Top feed refresh', result);
    return res.json(result);
  } catch (err) {
    logger.warn('Top feed refresh failed:', err.message);
    return res.status(502).json({ status: 'failed', error: 'refresh failed' });
  }
});

module.exports = router;
