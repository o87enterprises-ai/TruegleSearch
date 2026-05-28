// Token Routes for Freemium System
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const TokenService = require('../services/TokenService');
const { authenticate } = require('../middleware/auth');

// Server-side ad session tracking to prevent spoofed ad completions
const adSessions = new Map();
const AD_SESSION_TTL_MS = 120 * 1000; // 2 minutes max for an ad session
const AD_MIN_DURATION_MS = 25 * 1000; // Must wait at least 25s (buffer below 30s)
const MAX_ADS_PER_HOUR = 6;
const adRateTracker = new Map(); // userId -> [timestamps]

// Cleanup expired ad sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of adSessions) {
    if (now - session.createdAt > AD_SESSION_TTL_MS) {
      adSessions.delete(sessionId);
    }
  }
  for (const [userId, timestamps] of adRateTracker) {
    const recent = timestamps.filter(t => now - t < 3600000);
    if (recent.length === 0) adRateTracker.delete(userId);
    else adRateTracker.set(userId, recent);
  }
}, 60000).unref();

/**
 * GET /api/tokens/balance
 * Get user's token balance and stats
 */
router.get('/balance', authenticate, async (req, res) => {
  try {
    const balance = await TokenService.getBalance(req.user.userId);
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get token balance'
    });
  }
});

/**
 * GET /api/tokens/usage
 * Get feature usage statistics
 */
router.get('/usage', authenticate, async (req, res) => {
  try {
    const stats = await TokenService.getUsageStats(req.user.userId);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get usage stats'
    });
  }
});

/**
 * POST /api/tokens/check-access
 * Check if user can access a feature
 */
router.post('/check-access', authenticate, async (req, res) => {
  try {
    const { featureName } = req.body;

    if (!featureName) {
      return res.status(400).json({
        success: false,
        message: 'Feature name is required'
      });
    }

    const access = await TokenService.canAccessFeature(req.user.userId, featureName);
    res.json({
      success: true,
      data: access
    });
  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check feature access'
    });
  }
});

/**
 * POST /api/tokens/spend
 * Spend token for feature access
 */
router.post('/spend', authenticate, async (req, res) => {
  try {
    const { featureName } = req.body;

    if (!featureName) {
      return res.status(400).json({
        success: false,
        message: 'Feature name is required'
      });
    }

    const result = await TokenService.spendToken(req.user.userId, featureName);

    if (!result.success) {
      return res.status(402).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Spend token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to spend token'
    });
  }
});

/**
 * POST /api/tokens/ad-session
 * Start a server-tracked ad session (must be called before earn/ad)
 */
router.post('/ad-session', authenticate, (req, res) => {
  const userId = req.user.userId;

  // Rate limit: max ads per hour
  const now = Date.now();
  const userAds = (adRateTracker.get(userId) || []).filter(t => now - t < 3600000);
  if (userAds.length >= MAX_ADS_PER_HOUR) {
    return res.status(429).json({
      success: false,
      message: `Maximum ${MAX_ADS_PER_HOUR} ad rewards per hour`
    });
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  adSessions.set(sessionId, { userId, createdAt: now });

  res.json({ success: true, sessionId });
});

/**
 * POST /api/tokens/earn/ad
 * Earn token from watching ad (requires valid ad session)
 */
router.post('/earn/ad', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Ad session ID is required. Call /api/tokens/ad-session first.'
      });
    }

    // Verify the ad session exists and belongs to this user
    const session = adSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired ad session'
      });
    }

    if (session.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Ad session does not belong to this user'
      });
    }

    // Verify minimum time has elapsed server-side
    const elapsed = Date.now() - session.createdAt;
    if (elapsed < AD_MIN_DURATION_MS) {
      return res.status(400).json({
        success: false,
        message: 'Ad not completed. Please watch the full ad.'
      });
    }

    // Consume the session (one-time use)
    adSessions.delete(sessionId);

    // Track rate
    const userId = req.user.userId;
    const userAds = adRateTracker.get(userId) || [];
    userAds.push(Date.now());
    adRateTracker.set(userId, userAds);

    const durationSeconds = Math.floor(elapsed / 1000);
    const result = await TokenService.earnFromAd(userId, sessionId, durationSeconds);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Earn from ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process ad reward'
    });
  }
});

/**
 * POST /api/tokens/earn/game
 * Earn token from completing game level
 */
router.post('/earn/game', authenticate, async (req, res) => {
  try {
    const { levelCompleted } = req.body;

    if (typeof levelCompleted !== 'number' || levelCompleted < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid level number is required'
      });
    }

    const result = await TokenService.earnFromGame(req.user.userId, levelCompleted);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        data: { gameTokensEarned: result.gameTokensEarned }
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Earn from game error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process game reward'
    });
  }
});

/**
 * GET /api/tokens/history
 * Get token transaction history
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await TokenService.getTransactionHistory(req.user.userId, limit);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction history'
    });
  }
});

/**
 * GET /api/tokens/config
 * Get feature configuration (public)
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: TokenService.getFeatureConfig()
  });
});

module.exports = router;
