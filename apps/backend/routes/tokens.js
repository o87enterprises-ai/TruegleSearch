// Token Routes for Freemium System
const express = require('express');
const router = express.Router();
const TokenService = require('../services/TokenService');
const { authenticate } = require('../middleware/auth');

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
 * POST /api/tokens/earn/ad
 * Earn token from watching ad
 */
router.post('/earn/ad', authenticate, async (req, res) => {
  try {
    const { adId, durationSeconds } = req.body;

    if (!adId || typeof durationSeconds !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Ad ID and duration are required'
      });
    }

    const result = await TokenService.earnFromAd(req.user.userId, adId, durationSeconds);

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
