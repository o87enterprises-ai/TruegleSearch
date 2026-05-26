const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rateLimitSearch } = require('../middleware/rateLimit');
const SearchService = require('../services/SearchService');

// Initialize search service
const searchService = new SearchService();

/**
 * @route   POST /api/search
 * @desc    Perform unbiased search across multiple sources
 * @access  Public (rate limited)
 */
router.post('/', rateLimitSearch, async (req, res) => {
  try {
    const { query, filters = {} } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Search query is required and must be a non-empty string',
      });
    }

    // Validate filters
    const validFilters = validateFilters(filters);

    // Perform search using the search service
    const results = await searchService.performSearch(query, validFilters);

    res.json({
      success: true,
      query: query.trim(),
      filters: validFilters,
      results: results,
      timestamp: new Date().toISOString(),
      resultCount: results.length,
    });
  } catch (error) {
    console.error('Search error:', error);

    if (
      error.message.includes('API key') ||
      error.message.includes('authentication')
    ) {
      return res.status(500).json({
        error: 'Service configuration error',
        message:
          'Search service is temporarily unavailable. Please try again later.',
      });
    }

    if (
      error.message.includes('rate limit') ||
      error.message.includes('quota')
    ) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Search quota exceeded. Please try again in a few moments.',
      });
    }

    res.status(500).json({
      error: 'Search failed',
      message: 'Unable to perform search at this time. Please try again.',
    });
  }
});

/**
 * @route   GET /api/search/sources
 * @desc    Get available search sources and their status
 * @access  Private
 */
router.get('/sources', authenticate, async (req, res) => {
  try {
    const sources = await searchService.getAvailableSources();
    res.json({
      success: true,
      sources: sources,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sources error:', error);
    res.status(500).json({
      error: 'Unable to fetch sources',
      message: 'Failed to retrieve search source information',
    });
  }
});

/**
 * @route   GET /api/search/health
 * @desc    Check search service health
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = await searchService.getHealthStatus();
    res.json({
      status: 'OK',
      services: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'Degraded',
      error: 'Search service unhealthy',
      message: 'One or more search services are unavailable',
    });
  }
});

// Helper function to validate and sanitize filters
function validateFilters(filters) {
  const defaultFilters = {
    category: 'all',
    dateRange: 'any',
    bias: 'all',
    safeSearch: true,
    page: 1,
    perPage: 10,
  };

  const validFilters = { ...defaultFilters, ...filters };

  // Validate category
  const validCategories = [
    'all',
    'web',
    'news',
    'videos',
    'images',
    'shopping',
    'social',
  ];
  if (!validCategories.includes(validFilters.category)) {
    validFilters.category = 'all';
  }

  // Validate dateRange
  const validDateRanges = ['any', 'day', 'week', 'month', 'year'];
  if (!validDateRanges.includes(validFilters.dateRange)) {
    validFilters.dateRange = 'any';
  }

  // Validate bias
  const validBiases = [
    'all',
    'left',
    'right',
    'center',
    'unbiased',
    'mainstream',
  ];
  if (!validBiases.includes(validFilters.bias)) {
    validFilters.bias = 'all';
  }

  // Validate pagination
  validFilters.page = Math.max(1, parseInt(validFilters.page) || 1);
  validFilters.perPage = Math.min(
    Math.max(1, parseInt(validFilters.perPage) || 10),
    50
  );

  return validFilters;
}

module.exports = router;
