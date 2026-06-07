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
    const { query, filters = {}, mode = 'blue-pill' } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Search query is required and must be a non-empty string',
      });
    }

    // Validate filters
    const validFilters = validateFilters(filters);

    // Perform search using the search service
    const results = await searchService.performSearch(query, validFilters, mode);

    const instantAnswer = buildInstantAnswer(query.trim(), results);

    res.json({
      success: true,
      query: query.trim(),
      filters: validFilters,
      results: results,
      instantAnswer: instantAnswer || null,
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
    safeSearch: 'safe', // 'safe' | 'blur' | 'off'
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
    'all', 'left', 'right', 'center', 'unbiased', 'mainstream',
    'alternative', 'conspiracy', 'independent', 'neutral',
  ];
  if (!validBiases.includes(validFilters.bias)) {
    validFilters.bias = 'all';
  }

  // Perspectives: array of UI perspective IDs for purple mode
  if (Array.isArray(filters.perspectives)) {
    validFilters.perspectives = filters.perspectives.filter(p => typeof p === 'string');
  }

  // Validate pagination
  validFilters.page = Math.max(1, parseInt(validFilters.page) || 1);
  validFilters.perPage = Math.min(
    Math.max(1, parseInt(validFilters.perPage) || 10),
    50
  );

  return validFilters;
}

/**
 * Detect query type to determine instant answer card type.
 */
function detectQueryType(query) {
  const q = query.toLowerCase().trim();

  // Phone number pattern
  if (/[\+\d][\d\s\-\(\)]{7,}/.test(query)) return 'phone';

  // Business/local: "near me", "hours", "address", "phone number"
  if (/\b(near me|hours|open now|address|phone number|directions|location)\b/.test(q))
    return 'local_business';

  // Direct business name (contains common business suffixes)
  if (/\b(walmart|target|safeway|starbucks|mcdonald|walgreens|cvs|costco|amazon|apple store|home depot|kroger|whole foods|trader joe)\b/.test(q))
    return 'local_business';

  // Weather
  if (/^(weather|forecast)\b/.test(q) || /\bweather\b/.test(q)) return 'weather';

  // Calculator / unit conversion
  if (/^\d[\d\s\+\-\*\/\^\(\)\.]+=$/.test(q) || /\d+\s*(plus|minus|times|divided by|percent of)\s*\d+/i.test(q))
    return 'calculation';

  // Social profile / person search (name + platform)
  if (/\b(facebook|instagram|twitter|linkedin|tiktok|youtube)\b/.test(q)) return 'social_profile';

  // Person name (2-4 capitalized words, no other keywords)
  if (/^[A-Z][a-z]+ ([A-Z][a-z]+ ?){1,2}$/.test(query)) return 'person';

  return null;
}

/**
 * Extract structured instant answer data from search results + pagemap.
 */
function buildInstantAnswer(query, results) {
  if (!results || results.length === 0) return null;

  const type = detectQueryType(query);
  if (!type) return null;

  const top = results[0];
  const pagemap = top.pagemap || {};
  const meta = (pagemap.metatags || [])[0] || {};
  const org = (pagemap.organization || [])[0] || {};
  const local = (pagemap.localbusiness || [])[0] || {};
  const person = (pagemap.person || [])[0] || {};

  if (type === 'local_business') {
    const name = local.name || org.name || top.title || query;
    const phone = local.telephone || org.telephone || meta['og:phone_number'] || null;
    const address = local.address || org.address ||
      (local['address.streetaddress']
        ? `${local['address.streetaddress']}, ${local['address.addresslocality'] || ''} ${local['address.addressregion'] || ''}`.trim()
        : null) || null;
    const hours = local.openingHours || local.openinghours || null;
    const rating = local.aggregateRating || local.ratingvalue || null;
    const website = top.url || null;
    const image = top.image || meta['og:image'] || null;
    const lat = local.latitude || null;
    const lng = local.longitude || null;

    if (!name && !phone && !address) return null;

    return {
      type: 'local_business',
      name,
      phone,
      address,
      hours,
      rating,
      website,
      image,
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      mapsQuery: address || name,
    };
  }

  if (type === 'social_profile') {
    const profiles = results.slice(0, 5).map(r => ({
      name: r.title,
      url: r.url,
      snippet: r.snippet,
      image: r.image || null,
      platform: detectPlatform(r.url),
    })).filter(p => p.platform);

    if (profiles.length === 0) return null;
    return { type: 'social_profile', query, profiles };
  }

  if (type === 'person') {
    const p = {
      name: person.name || query,
      description: meta['og:description'] || top.snippet || null,
      image: top.image || meta['og:image'] || null,
      url: top.url,
      title: person.jobtitle || null,
      profiles: results.slice(0, 4).filter(r => detectPlatform(r.url)).map(r => ({
        platform: detectPlatform(r.url),
        url: r.url,
        title: r.title,
      })),
    };
    if (!p.description && !p.image) return null;
    return { type: 'person', ...p };
  }

  return null;
}

function detectPlatform(url) {
  if (!url) return null;
  if (url.includes('facebook.com')) return 'Facebook';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'X / Twitter';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('youtube.com')) return 'YouTube';
  if (url.includes('github.com')) return 'GitHub';
  if (url.includes('reddit.com')) return 'Reddit';
  return null;
}

module.exports = router;
