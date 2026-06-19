// Rewards Program Routes — opt-in cash rewards for honestly-viewed ads.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const RewardsService = require('../services/RewardsService');
const { authenticate } = require('../middleware/auth');

// Server-side impression session tracking, mirroring the anti-spoofing pattern
// used for token-earning ad watches in routes/tokens.js: a session is opened
// when the ad becomes visible, and /earn can only succeed once real wall-clock
// time has elapsed and the session hasn't already been consumed.
const impressionSessions = new Map();
const SESSION_TTL_MS = 5 * 60 * 1000; // sessions older than this are abandoned
const { minVisibleMs: MIN_VISIBLE_MS } = RewardsService.getConfig();

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of impressionSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      impressionSessions.delete(sessionId);
    }
  }
}, 60000).unref();

/**
 * GET /api/rewards/config
 * Public program economics (for display before a user opts in)
 */
router.get('/config', (req, res) => {
  res.json({ success: true, data: RewardsService.getConfig() });
});

/**
 * GET /api/rewards/status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await RewardsService.getStatus(req.user.userId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Get rewards status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get rewards status' });
  }
});

/**
 * POST /api/rewards/opt-in
 */
router.post('/opt-in', authenticate, async (req, res) => {
  try {
    const status = await RewardsService.optIn(req.user.userId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Rewards opt-in error:', error);
    res.status(500).json({ success: false, message: 'Failed to opt in' });
  }
});

/**
 * POST /api/rewards/opt-out
 */
router.post('/opt-out', authenticate, async (req, res) => {
  try {
    const status = await RewardsService.optOut(req.user.userId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Rewards opt-out error:', error);
    res.status(500).json({ success: false, message: 'Failed to opt out' });
  }
});

/**
 * POST /api/rewards/impression-session
 * Open a server-tracked session when a reward-eligible ad becomes visible.
 */
router.post('/impression-session', authenticate, async (req, res) => {
  try {
    const status = await RewardsService.getStatus(req.user.userId);
    if (!status.optedIn) {
      return res.status(403).json({ success: false, message: 'Not opted into the Rewards Program' });
    }

    const { adId, zone } = req.body;
    const sessionId = crypto.randomBytes(16).toString('hex');
    impressionSessions.set(sessionId, {
      userId: req.user.userId,
      adId: adId || null,
      zone: zone || 'unknown',
      createdAt: Date.now(),
    });

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Open impression session error:', error);
    res.status(500).json({ success: false, message: 'Failed to open impression session' });
  }
});

/**
 * POST /api/rewards/earn
 * Claim the reward for a session, once it has been visible long enough.
 * `visibleMs` is the client's own accumulated-visibility measurement
 * (IntersectionObserver); it can only ever reduce the awarded duration below
 * server wall-clock time, never inflate it, so a spoofed client can't earn
 * faster than honest real-time viewing would allow.
 */
router.post('/earn', authenticate, async (req, res) => {
  try {
    const { sessionId, visibleMs } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'sessionId is required. Call /api/rewards/impression-session first.',
      });
    }

    const session = impressionSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, message: 'Invalid or expired impression session' });
    }
    if (session.userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Session does not belong to this user' });
    }

    const elapsedMs = Date.now() - session.createdAt;
    const claimedVisibleMs = Number.isFinite(visibleMs) ? Math.max(0, visibleMs) : 0;
    // Never trust the client beyond real elapsed time.
    const verifiedVisibleMs = Math.min(claimedVisibleMs, elapsedMs);

    if (verifiedVisibleMs < MIN_VISIBLE_MS) {
      return res.status(400).json({
        success: false,
        message: 'Ad was not visible long enough to qualify for a reward',
      });
    }

    // One-time use.
    impressionSessions.delete(sessionId);

    const result = await RewardsService.earnFromImpression(
      req.user.userId,
      session.adId,
      session.zone,
      verifiedVisibleMs
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Earn from impression error:', error);
    res.status(500).json({ success: false, message: 'Failed to process reward' });
  }
});

/**
 * GET /api/rewards/ledger
 */
router.get('/ledger', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const ledger = await RewardsService.getLedger(req.user.userId, limit);
    res.json({ success: true, data: ledger });
  } catch (error) {
    console.error('Get rewards ledger error:', error);
    res.status(500).json({ success: false, message: 'Failed to get rewards history' });
  }
});

/**
 * GET /api/rewards/payouts
 */
router.get('/payouts', authenticate, async (req, res) => {
  try {
    const payouts = await RewardsService.getPayoutRequests(req.user.userId);
    res.json({ success: true, data: payouts });
  } catch (error) {
    console.error('Get payout requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payout requests' });
  }
});

/**
 * POST /api/rewards/payout-request
 */
router.post('/payout-request', authenticate, async (req, res) => {
  try {
    const { method, destination } = req.body;

    if (!destination || typeof destination !== 'string') {
      return res.status(400).json({ success: false, message: 'A payout destination (e.g. email/PayPal) is required' });
    }

    const result = await RewardsService.requestPayout(req.user.userId, method, destination);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Payout request error:', error);
    res.status(500).json({ success: false, message: 'Failed to request payout' });
  }
});

module.exports = router;
