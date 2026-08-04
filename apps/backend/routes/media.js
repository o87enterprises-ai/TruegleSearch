const express = require('express');

const router = express.Router();
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { rateLimitSearch } = require('../middleware/rateLimit');
const { MediaService } = require('../services/MediaService');

const ERRORS = {
  INVALID: 400,
  UNAUTHENTICATED: 401,
  UNSUPPORTED: 422,
  NOT_FOUND: 404,
};

function mapError(err, res) {
  const status = ERRORS[err && err.code];
  if (status) return res.status(status).json({ error: err.message, code: err.code });
  logger.error('Media route error:', { error: err && err.message });
  return res.status(500).json({ error: 'Something went wrong with that link.' });
}

/**
 * GET /api/media/search?q=…&limit=12
 * PUBLIC — this is the half that makes a submission worth making: once one
 * person adds a link, everyone can find it, by title or by the link itself.
 */
router.get('/search', async (req, res) => {
  try {
    const results = await MediaService.search({ q: req.query.q, limit: req.query.limit });
    return res.json({ success: true, results });
  } catch (err) {
    return mapError(err, res);
  }
});

/** GET /api/media — newest submissions. Public, same reasoning as above. */
router.get('/', async (req, res) => {
  try {
    const results = await MediaService.list({ limit: req.query.limit });
    return res.json({ success: true, results });
  } catch (err) {
    return mapError(err, res);
  }
});

/**
 * POST /api/media  { url, title? }
 * SIGNED IN ONLY. A submission becomes playable for every visitor, so it is
 * attributable: `authenticate` (not optionalAuth) rejects anonymous writes,
 * and community_media.submitted_by is NOT NULL behind it.
 *
 * Nothing is uploaded — the link is classified and stored, and the media plays
 * from its original platform so the creator keeps their views.
 */
router.post('/', authenticate, rateLimitSearch, async (req, res) => {
  try {
    const { url, title } = req.body || {};
    const userId = req.user && req.user.userId;
    const media = await MediaService.submit({ url, title, userId });
    return res.json({ success: true, media });
  } catch (err) {
    return mapError(err, res);
  }
});

/** POST /api/media/:id/play — best-effort popularity signal for ordering. */
router.post('/:id/play', async (req, res) => {
  await MediaService.countPlay(req.params.id);
  return res.json({ success: true });
});

/** POST /api/media/:id/report — soft moderation, see MediaService.report. */
router.post('/:id/report', rateLimitSearch, async (req, res) => {
  try {
    const result = await MediaService.report(req.params.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return mapError(err, res);
  }
});

module.exports = router;
