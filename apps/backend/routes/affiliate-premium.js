// Affiliate Premium Offer Routes — self-reported "sign up via an affiliate
// offer, get 1 month of Premium free." See AffiliatePremiumService.js for the
// verification model (hybrid: granted on self-report now, clawed back if a
// future real postback never confirms it).
const express = require('express');
const router = express.Router();
const AffiliatePremiumService = require('../services/AffiliatePremiumService');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/affiliate-premium/config
 * Public program economics + eligible offer ids.
 */
router.get('/config', (req, res) => {
  res.json({ success: true, data: AffiliatePremiumService.getConfig() });
});

/**
 * GET /api/affiliate-premium/status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await AffiliatePremiumService.getStatus(req.user.userId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Get affiliate premium status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get status' });
  }
});

/**
 * POST /api/affiliate-premium/claim
 * Body: { offerId }
 */
router.post('/claim', authenticate, async (req, res) => {
  try {
    const { offerId } = req.body;
    if (!offerId || typeof offerId !== 'string') {
      return res.status(400).json({ success: false, message: 'offerId is required' });
    }

    const result = await AffiliatePremiumService.claimOffer(req.user.userId, offerId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Claim affiliate premium offer error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim offer' });
  }
});

module.exports = router;
