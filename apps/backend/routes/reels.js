const express = require('express');

const router = express.Router();
const logger = require('../utils/logger');
const { optionalAuth } = require('../middleware/auth');
const { rateLimitSearch } = require('../middleware/rateLimit');
const { ReelsService } = require('../services/ReelsService');

const ERRORS = {
  INVALID: 400,
  UNSUPPORTED: 422,
  NOT_FOUND: 404,
};

function mapError(err, res) {
  const status = ERRORS[err && err.code];
  if (status) return res.status(status).json({ error: err.message, code: err.code });
  logger.error('Reels route error:', { error: err && err.message });
  return res.status(500).json({ error: 'Something went wrong with that reel.' });
}

/**
 * GET /api/reels?platform=TikTok&limit=40
 * The community-submitted half of the reels feed.
 */
router.get('/', async (req, res) => {
  try {
    const reels = await ReelsService.list({
      platform: req.query.platform || null,
      limit: req.query.limit,
    });
    return res.json({ success: true, reels });
  } catch (err) {
    return mapError(err, res);
  }
});

/**
 * POST /api/reels  { url, title? }
 * Add a reel. Only genuine short-form URLs are accepted — the service
 * classifies the link and rejects anything that isn't a Short/Reel/TikTok.
 * Nothing is uploaded: we store the link, the clip plays from its original
 * platform so the creator keeps the views.
 */
router.post('/', optionalAuth, rateLimitSearch, async (req, res) => {
  try {
    const { url, title } = req.body || {};
    const user = req.user;
    const userId = user && user.isAuthenticated && user.userId ? user.userId : null;
    const reel = await ReelsService.submit({ url, title, userId });
    return res.json({ success: true, reel });
  } catch (err) {
    return mapError(err, res);
  }
});

/** POST /api/reels/:id/report — soft moderation, see ReelsService.report. */
router.post('/:id/report', rateLimitSearch, async (req, res) => {
  try {
    const result = await ReelsService.report(req.params.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return mapError(err, res);
  }
});

module.exports = router;
