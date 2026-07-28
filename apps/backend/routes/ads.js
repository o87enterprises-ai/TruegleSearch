// Ad configuration routes — serves the geo-targeted, highest-CPM Adsterra zones
// for the visitor's country of origin (see GeoAdService). Public and cacheable
// per-country so the frontend can fetch it once on load.
const express = require('express');
const router = express.Router();
const GeoAdService = require('../services/GeoAdService');

/**
 * GET /api/ads/config
 * Returns { country, tier, isTier1, usingFallback, zones: { nativeBanner,
 * socialBar, popunder } } resolved from the request's country of origin.
 */
router.get('/config', async (req, res) => {
  try {
    const cfg = await GeoAdService.getAdConfig(req);
    // Cache per-country at the edge/CDN — the mapping only changes when zones
    // are edited server-side, and it must not be shared across countries.
    res.set('Cache-Control', 'public, max-age=1800');
    res.set('Vary', 'CF-IPCountry, X-Vercel-IP-Country');
    res.json({ success: true, data: cfg });
  } catch (error) {
    console.error('Ad config error:', error);
    // Never break ad serving — fall back to the global DEFAULT zone.
    res.json({ success: true, data: await GeoAdService.getAdConfig({ headers: {} }).catch(() => ({})) });
  }
});

module.exports = router;
