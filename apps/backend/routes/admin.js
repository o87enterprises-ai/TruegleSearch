// Admin routes — privileged operations gated by a shared admin key.
//
// Protected by the ADMIN_API_KEY env var, supplied on the `x-admin-key` request
// header. Deliberately simple (single shared key, no user session) since these
// are operator-only endpoints called by hand / a small internal tool, not by
// the app UI.
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const RewardsService = require('../services/RewardsService');
const { PlayerHealthService } = require('../services/PlayerHealthService');

// Constant-time comparison: hash both sides so the buffers are the same length
// (timingSafeEqual throws on a length mismatch) and the compare time does not
// leak how much of the key a guess got right.
function keyMatches(given, expected) {
  if (typeof given !== 'string' || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// Gate every admin route on the shared key.
router.use((req, res, next) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(503).json({ error: 'Admin API is not configured (ADMIN_API_KEY unset)' });
  }
  if (!keyMatches(req.headers['x-admin-key'], adminKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

/**
 * POST /api/admin/rewards/credit
 * Manual reward credit after an admin verifies a user's forwarded conversion-
 * confirmation email (Adsterra has no S2S postback — see routes/rewards.js).
 * Body: { userId, amount, proofNote } where `amount` is US dollars.
 */
router.post('/rewards/credit', async (req, res) => {
  const { userId, amount, proofNote } = req.body || {};
  if (userId === undefined || userId === null || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'userId and amount (US dollars) are required' });
  }
  try {
    const result = await RewardsService.creditManual(userId, amount, proofNote);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Manual rewards credit error:', error);
    return res.status(500).json({ error: 'Failed to credit user' });
  }
});

/**
 * GET /api/admin/player-health?days=7[&reason=silent]  (reason adds the 20 newest traces for it)
 * The owner's "check it periodically" view onto the player's automatic
 * health beacons (routes/player.js, PlayerHealthService) — counts by
 * reason/kind/platform and the top error codes, never raw rows with
 * anything identifying in them (there is nothing identifying to return:
 * see migrations/025_player_health.sql). scripts/player-health.mjs is the
 * normal way to read this.
 */
router.get('/player-health', async (req, res) => {
  try {
    const summary = await PlayerHealthService.summary({ days: req.query.days, reason: req.query.reason });
    return res.json({ success: true, ...summary });
  } catch (error) {
    console.error('Player health summary error:', error);
    return res.status(500).json({ error: 'Failed to read player health' });
  }
});

/**
 * GET /api/admin/upstream-health
 * Which paid/quota-limited providers are cooling down right now, and why (utils/breaker.js),
 * plus the keyless YouTube pool's per-instance health. Per warm instance — serverless
 * instances each learn separately — so read it as "what this instance currently believes".
 */
router.get('/upstream-health', async (req, res) => {
  const { breakers } = require('../utils/breaker');
  const YouTubeGateway = require('../services/YouTubeGateway');
  const upstream = require('../utils/upstreamStats');
  let history = null;
  try { history = await upstream.history(req.query.days); } catch { /* no database: instance counters only */ }
  res.json({
    success: true,
    coolingDown: breakers.status(),
    youtubePool: YouTubeGateway.poolStatus(),
    history,                       // per UTC day: provider x outcome (may undercount — serverless)
    thisInstance: upstream.snapshot(),
  });
});

router.keyMatches = keyMatches;
module.exports = router;
