/**
 * Weather API Routes
 * Handles weather queries and forecasts
 */
const express = require('express');
const router = express.Router();
const WeatherService = require('../services/WeatherService');

/**
 * Get current weather
 * POST /api/weather/current
 */
router.post('/current', async (req, res) => {
  try {
    const { location } = req.body;

    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        message: 'Please provide a city name or location',
      });
    }

    const weatherData = await WeatherService.getCurrentWeather(location);

    res.json({
      success: true,
      data: weatherData,
    });
  } catch (error) {
    console.error('Weather route error:', error);
    res.status(500).json({
      error: 'Weather service error',
      message: error.message,
    });
  }
});

/**
 * Get weather forecast
 * POST /api/weather/forecast
 */
router.post('/forecast', async (req, res) => {
  try {
    const { location } = req.body;

    if (!location) {
      return res.status(400).json({
        error: 'Location is required',
        message: 'Please provide a city name or location',
      });
    }

    const forecastData = await WeatherService.getForecast(location);

    res.json({
      success: true,
      data: forecastData,
    });
  } catch (error) {
    console.error('Weather forecast route error:', error);
    res.status(500).json({
      error: 'Weather forecast error',
      message: error.message,
    });
  }
});

/**
 * Health check endpoint
 * GET /api/weather/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Weather Service',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
