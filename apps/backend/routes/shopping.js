/**
 * Shopping API Routes
 * Handles product search and price comparison
 */
const express = require('express');
const router = express.Router();
const shoppingService = require('../services/ShoppingService');
const { rateLimitSearch } = require('../middleware/rateLimit');

/**
 * POST /api/shopping/search
 * Search for products
 */
router.post('/search', rateLimitSearch, async (req, res) => {
  try {
    const { query, filters = {} } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_QUERY',
        message: 'Search query is required',
      });
    }

    // Prepare options
    const options = {
      location: filters.location || 'United States',
      language: filters.language || 'en',
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
    };

    // Search for products
    const results = await shoppingService.searchProducts(query, options);

    res.json({
      success: true,
      data: results,
      query,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Shopping search error:', error);

    // Handle specific errors
    if (error.message.includes('API key')) {
      return res.status(500).json({
        success: false,
        error: 'API_ERROR',
        message: 'Shopping service configuration error',
      });
    }

    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT',
        message: 'Too many requests. Please try again later.',
      });
    }

    res.status(500).json({
      success: false,
      error: 'SEARCH_FAILED',
      message: 'Failed to search for products',
      details: 'Service unavailable',
    });
  }
});

/**
 * POST /api/shopping/compare
 * Compare prices for a specific product
 */
router.post('/compare', rateLimitSearch, async (req, res) => {
  try {
    const { productName, filters = {} } = req.body;

    if (!productName || productName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PRODUCT',
        message: 'Product name is required',
      });
    }

    const options = {
      location: filters.location || 'United States',
      language: filters.language || 'en',
    };

    const comparison = await shoppingService.comparePrice(productName, options);

    res.json({
      success: true,
      data: comparison,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Price comparison error:', error);

    res.status(500).json({
      success: false,
      error: 'COMPARISON_FAILED',
      message: 'Failed to compare prices',
      details: 'Service unavailable',
    });
  }
});

/**
 * POST /api/shopping/clear-cache
 * Clear cache for a specific query (admin/debugging)
 */
router.post('/clear-cache', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_QUERY',
        message: 'Query is required to clear cache',
      });
    }

    const result = await shoppingService.clearCache(query);

    res.json({
      success: true,
      data: result,
      message: `Cleared ${result.cleared} cache entries`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Clear cache error:', error);

    res.status(500).json({
      success: false,
      error: 'CLEAR_CACHE_FAILED',
      message: 'Failed to clear cache',
      details: 'Service unavailable',
    });
  }
});

/**
 * GET /api/shopping/stats
 * Get cache and service statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await shoppingService.getCacheStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get stats error:', error);

    res.status(500).json({
      success: false,
      error: 'STATS_FAILED',
      message: 'Failed to get statistics',
      details: 'Service unavailable',
    });
  }
});

/**
 * GET /api/shopping/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const health = await shoppingService.healthCheck();

    if (!health.healthy) {
      return res.status(503).json({
        success: false,
        ...health,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
