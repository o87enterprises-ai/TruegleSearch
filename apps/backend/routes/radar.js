const express = require('express');
const router = express.Router();
const RadarService = require('../services/RadarService');

// Radar is optional, and "not configured" is not a server fault.
//
// Every handler below turns any upstream failure into a 500. With no key the
// upstream failure is a 401 on every single call, so an unconfigured Radar
// reported itself as a broken server — the ladder in mapApi.js printed
// "radar: Request failed with status code 500" on the map, which reads as an
// outage and cost a round of API-key replacement to rule out. 503 with the
// reason is the truth, and it spends no upstream request to say it.
router.use((req, res, next) => {
  if (RadarService.isConfigured()) return next();
  return res.status(503).json({
    success: false,
    error: 'Radar not configured',
    message: `Radar ${process.env.NODE_ENV === 'development' ? 'test' : 'live'} secret key is not set`,
  });
});

router.post('/geocode', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide an address or place name',
      });
    }
    const result = await RadarService.forwardGeocode(query);
    // Return address data in expected format
    res.json({
      success: result.success,
      data: result.address ? [result.address] : [],
      meta: result.meta
    });
  } catch (error) {
    console.error('Radar geocode error:', error);
    res.status(500).json({
      error: 'Geocoding failed',
      message: error.message,
    });
  }
});

router.post('/autocomplete', async (req, res) => {
  try {
    const { query, near, limit } = req.body;
    if (!query) {
      return res.status(400).json({
        error: 'Query required',
        message: 'Please provide a search query',
      });
    }
    const result = await RadarService.autocomplete(query, near, limit);
    res.json(result);
  } catch (error) {
    console.error('Radar autocomplete error:', error);
    res.status(500).json({
      error: 'Autocomplete failed',
      message: error.message,
    });
  }
});

router.post('/reverse-geocode', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Coordinates required',
        message: 'Please provide latitude and longitude',
      });
    }
    const result = await RadarService.reverseGeocode({ latitude, longitude });
    res.json(result);
  } catch (error) {
    console.error('Radar reverse geocode error:', error);
    res.status(500).json({
      error: 'Reverse geocoding failed',
      message: error.message,
    });
  }
});

router.post('/directions', async (req, res) => {
  try {
    const { origin, destination, options } = req.body;
    if (!origin || !destination || !origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
      return res.status(400).json({
        error: 'Origin and destination required',
        message: 'Please provide valid coordinates for both origin and destination',
      });
    }
    const result = await RadarService.getDirections(origin, destination, options);
    res.json(result);
  } catch (error) {
    console.error('Radar directions error:', error);
    res.status(500).json({
      error: 'Directions failed',
      message: error.message,
    });
  }
});

router.post('/distance', async (req, res) => {
  try {
    const { origin, destination, options } = req.body;
    if (!origin || !destination || !origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
      return res.status(400).json({
        error: 'Origin and destination required',
        message: 'Please provide valid coordinates for both origin and destination',
      });
    }
    const result = await RadarService.getDistance(origin, destination, options);
    res.json(result);
  } catch (error) {
    console.error('Radar distance error:', error);
    res.status(500).json({
      error: 'Distance calculation failed',
      message: error.message,
    });
  }
});

router.post('/search-places', async (req, res) => {
  try {
    const { near, options } = req.body;
    if (!near || !near.lat || !near.lng) {
      return res.status(400).json({
        error: 'Near coordinates required',
        message: 'Please provide lat and lng for search center',
      });
    }
    // Convert lat/lng to latitude/longitude for RadarService
    const nearCoords = { latitude: near.lat, longitude: near.lng };
    const result = await RadarService.searchPlaces(nearCoords, options);
    // Return data in format expected by frontend (data instead of places)
    res.json({
      success: result.success,
      data: result.places || [],
      meta: result.meta
    });
  } catch (error) {
    console.error('Radar places search error:', error);
    res.status(500).json({
      error: 'Places search failed',
      message: error.message,
    });
  }
});

router.get('/health', async (req, res) => {
  try {
    const health = await RadarService.getHealthStatus();
    res.json({
      status: health.status === 'healthy' ? 'OK' : 'Degraded',
      service: 'Radar Maps Service',
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'Degraded',
      error: 'Radar service unhealthy',
      message: error.message,
    });
  }
});

module.exports = router;