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
 * GET|POST /api/rewards/postback
 * Server-to-server conversion postback from Adsterra (configure this URL in the
 * Adsterra dashboard's postback settings). Secret-gated so only the network can
 * credit conversions. Expected params (query or body), with common aliases:
 *   secret        — shared secret (must equal REWARDS_POSTBACK_SECRET)
 *   sub1 | subid  — the user's attribution ref
 *   conversion_id | cid | txid — network-unique conversion id (idempotency)
 *   payout | sum | amount      — conversion payout in USD
 *   offer         — offer name (optional)
 *   country       — geo (optional)
 * Responds with a plain 200 "OK" as postback endpoints expect.
 */
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

router.get('/postback', handlePostback);
router.post('/postback', handlePostback);

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
