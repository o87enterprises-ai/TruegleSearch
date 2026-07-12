const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { optionalAuth } = require('../middleware/auth');
const { rateLimitSearch } = require('../middleware/rateLimit');
const ShareService = require('../services/ShareService');

const SHARE_ERRORS = {
  INVALID: { status: 400, error: 'That thread could not be shared — it looks empty or malformed.' },
  TOO_LARGE: { status: 413, error: 'This conversation is too large to share as a link.' },
  NOT_FOUND: { status: 404, error: 'This shared link is invalid or has expired.' },
};

function mapError(err, res) {
  const m = SHARE_ERRORS[err && err.code];
  if (m) return res.status(m.status).json({ error: m.error, code: err.code });
  logger.error('Share route error:', { error: err && err.message });
  return res.status(500).json({ error: 'Something went wrong handling that share.' });
}

/**
 * POST /api/share  { kind?, payload }
 * Persists a chat/investigation thread and returns its short id + path.
 */
router.post('/', optionalAuth, rateLimitSearch, async (req, res) => {
  try {
    const { kind, payload } = req.body || {};
    const user = req.user;
    const userId = user && user.isAuthenticated && user.userId ? user.userId : null;
    const { id } = await ShareService.createShare({ kind, payload, userId });
    return res.json({ success: true, id, path: `/s/${id}` });
  } catch (err) {
    return mapError(err, res);
  }
});

/**
 * GET /api/share/:id  → the stored thread (read-only), counting the view.
 */
router.get('/:id', async (req, res) => {
  try {
    const share = await ShareService.getShare(req.params.id);
    return res.json({ success: true, ...share });
  } catch (err) {
    return mapError(err, res);
  }
});

module.exports = router;
