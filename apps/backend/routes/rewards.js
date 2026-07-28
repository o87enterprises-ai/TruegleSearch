// Rewards Program Routes — opt-in cash rewards for OFFER conversions.
const express = require('express');
const router = express.Router();
const RewardsService = require('../services/RewardsService');
const { authenticate } = require('../middleware/auth');

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
 * GET /api/rewards/offer-link
 * The user's personalized offer link. Completing any offer fires a network
 * conversion postback tagged with their attribution ref, which credits their
 * revenue-share. Opting in is required (the ref only exists once opted in).
 */
router.get('/offer-link', authenticate, async (req, res) => {
  try {
    const status = await RewardsService.getStatus(req.user.userId);
    if (!status.optedIn) {
      return res.status(403).json({ success: false, message: 'Opt into the Rewards Program to get your offer link' });
    }
    const url = await RewardsService.getOfferLink(req.user.userId);
    res.json({ success: true, data: { url } });
  } catch (error) {
    console.error('Offer link error:', error);
    res.status(500).json({ success: false, message: 'Failed to build offer link' });
  }
});

/**
 * GET|POST /api/rewards/postback  — DISABLED.
 *
 * Adsterra Publishers does not support server-to-server (S2S) postbacks, so this
 * endpoint can never receive conversion data — it is intentionally NOT
 * registered (see the commented-out router.get/post below). Conversions are now
 * verified MANUALLY: a user forwards their conversion-confirmation email to
 * support@truegle.info and an admin credits them via POST /api/admin/rewards/credit.
 * The handler is kept defined so the automatic flow is trivial to re-enable once
 * we move to a network that does support S2S postbacks.
 *
 * (When re-enabled, expected params — query or body, with common aliases:
 *   secret / x-postback-secret — must equal REWARDS_POSTBACK_SECRET
 *   sub1 | subid — user attribution ref; conversion_id | cid | txid — idempotency;
 *   payout | sum | amount — USD; offer, country — optional.)
 */
// eslint-disable-next-line no-unused-vars
async function handlePostback(req, res) {
  try {
    const p = { ...req.query, ...req.body };
    const secret = p.secret || req.headers['x-postback-secret'];
    const expected = process.env.REWARDS_POSTBACK_SECRET;

    if (!expected) {
      console.error('Rewards postback rejected: REWARDS_POSTBACK_SECRET is not configured');
      return res.status(503).send('postback not configured');
    }
    if (secret !== expected) {
      return res.status(403).send('forbidden');
    }

    const ref = p.sub1 || p.subid || p.sub_id || p.aff_sub;
    const conversionId = p.conversion_id || p.cid || p.txid || p.click_id || p.clickid;
    const payoutUsd = p.payout ?? p.sum ?? p.amount ?? p.revenue;

    const result = await RewardsService.recordConversion({
      ref,
      conversionId,
      payoutUsd,
      offerName: p.offer || p.offer_name || p.campaign,
      country: p.country || p.geo,
    });

    // Always 200 on a well-formed, authenticated call so the network doesn't
    // retry a conversion we deliberately ignored (duplicate / unknown ref).
    if (!result.success) {
      console.warn('Rewards postback not credited:', result.message);
      return res.status(200).send('OK (not credited)');
    }
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Rewards postback error:', error);
    return res.status(500).send('error');
  }
}

// DISABLED — Adsterra has no S2S postback support. Manual verification replaces
// it (user forwards confirmation email -> admin credits via /api/admin/rewards/credit).
// Re-enable both lines to restore automatic conversion crediting on a network
// that supports postbacks.
// router.get('/postback', handlePostback);
// router.post('/postback', handlePostback);

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
