/**
 * Optimization engine — read-only status route (the "GEO Pulse" surface).
 * No PII, no auth, no side effects: it only reports what the autopilot
 * citation engine has published and how much free-tier headroom remains.
 * The engine itself runs in GitHub Actions (it needs git write + no serverless
 * timeout), so there is deliberately no "trigger a run" endpoint here.
 */

const express = require('express');
const router = express.Router();
const { pulse } = require('../services/optimization/pulse');

// GET /api/optimization/pulse
router.get('/pulse', async (req, res) => {
  try {
    const status = await pulse();
    res.json({ success: true, ...status });
  } catch (e) {
    res.status(500).json({ success: false, error: 'pulse unavailable' });
  }
});

module.exports = router;
