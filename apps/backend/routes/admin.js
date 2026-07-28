// Admin routes — privileged operations gated by a shared admin key.
//
// Protected by the ADMIN_API_KEY env var, supplied on the `x-admin-key` request
// header. Deliberately simple (single shared key, no user session) since these
// are operator-only endpoints called by hand / a small internal tool, not by
// the app UI.
const express = require('express');
const router = express.Router();
const RewardsService = require('../services/RewardsService');

// Gate every admin route on the shared key.
router.use((req, res, next) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(503).json({ error: 'Admin API is not configured (ADMIN_API_KEY unset)' });
  }
  if (req.headers['x-admin-key'] !== adminKey) {
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

module.exports = router;
