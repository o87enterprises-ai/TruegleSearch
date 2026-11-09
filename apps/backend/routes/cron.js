// Scheduled jobs (Vercel Cron, see vercel.json "crons").
//
// GET /api/cron/refresh-top-feed — pre-build the landing page's top-posts feed
// once a day at 9:00 AM Pacific, so the first visitor of the day is served from
// the cache instead of waiting for the scrape (services/TopFeedCache.js).
//
// WHY TWO SCHEDULE ENTRIES: Vercel cron schedules are fixed UTC and know nothing
// of daylight saving. 9 AM Pacific is 16:00 UTC in summer and 17:00 UTC in
// winter, so both are scheduled and this handler does the work only when it is
// really the 9 o'clock hour in America/Los_Angeles; the other one answers
// "skipped". (On Vercel's Hobby plan a cron fires somewhere within its hour, so
// "9 AM" means the 9 o'clock hour there.)
//
// AUTH: if CRON_SECRET is set, Vercel sends it as `Authorization: Bearer …` and
// anything else is refused. If it is not set the endpoint still cannot be abused
// into extra work: it only acts in the 9 o'clock hour, and only when the current
// day's entry is not already built.
const crypto = require('crypto');
const express = require('express');
const logger = require('../utils/logger');
const TopFeedCache = require('../services/TopFeedCache');
const ContentLang = require('../services/ContentLang');
const { PREWARM_REQUEST } = require('../config/topFeed');
const { isRefreshHour, epochId } = require('../utils/cacheEpoch');

const router = express.Router();

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
  const force = req.query.force === '1';
  if (force && !auth.strong) return res.status(403).json({ error: 'force needs CRON_SECRET' });

  const now = Date.now();
  if (!force && !isRefreshHour(now)) {
    return res.json({ status: 'skipped', reason: 'not the 9 AM Pacific hour', epoch: epochId(now) });
  }
  try {
    const { buildFeedPayload } = require('./social');
    const result = await TopFeedCache.refreshTop(
      // Annotated with each post's language exactly as a visitor's build is.
      async () => ContentLang.annotate(await buildFeedPayload({
        q: PREWARM_REQUEST.query, requestedPlatforms: PREWARM_REQUEST.platforms,
        cur: PREWARM_REQUEST.cursor, limit: PREWARM_REQUEST.limit, allowAdult: PREWARM_REQUEST.adult,
      })),
      { force, now },
    );
    await TopFeedCache.prune();
    logger.info('Top feed refresh', result);
    return res.json(result);
  } catch (err) {
    logger.warn('Top feed refresh failed:', err.message);
    return res.status(502).json({ status: 'failed', error: 'refresh failed' });
  }
});

module.exports = router;
