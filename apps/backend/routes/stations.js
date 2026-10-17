const express = require('express');
const { countries, regions, stations } = require('../services/StationsService');

const router = express.Router();

/** GET /api/stations/countries → { countries: [{ code, name, count }] } */
router.get('/countries', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ countries: await countries() });
});

/** GET /api/stations/regions?country=US → { regions: [{ name, count }] } */
router.get('/regions', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ regions: await regions(req.query.country) });
});

/**
 * GET /api/stations?country=US&region=Oregon
 * GET /api/stations?lat=45.5&lng=-122.7&km=100
 * → { stations: [...] } — https streams only (see StationsService).
 */
router.get('/', async (req, res) => {
  const { country, region, lat, lng, km } = req.query;
  // Coordinates are a location: never cached by a shared proxy.
  res.set('Cache-Control', lat != null ? 'private, max-age=600' : 'public, max-age=600');
  res.json({ stations: await stations({ country, region, lat, lng, km }) });
});

module.exports = router;
