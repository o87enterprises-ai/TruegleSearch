const express = require('express');
const { query, validationResult } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const validateAnalyticsQuery = [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('source').optional().isIn(['google', 'bing', 'news', 'youtube', 'all']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
];

// Mock analytics data (in production, this would be from a database)
let searchAnalytics = [
  {
    id: 1,
    query: 'artificial intelligence',
    source: 'google',
    resultsCount: 10,
    responseTime: 450,
    timestamp: new Date('2024-01-15T10:30:00Z'),
    userId: null,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  },
  {
    id: 2,
    query: 'climate change news',
    source: 'news',
    resultsCount: 20,
    responseTime: 320,
    timestamp: new Date('2024-01-15T11:15:00Z'),
    userId: 1,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
];

let apiUsage = {
  totalSearches: 1500,
  successfulSearches: 1420,
  failedSearches: 80,
  averageResponseTime: 380,
  popularQueries: [
    { query: 'technology', count: 45 },
    { query: 'health', count: 38 },
    { query: 'education', count: 32 },
  ],
  sourceDistribution: {
    google: 65,
    news: 20,
    youtube: 10,
    bing: 5,
  },
};

// Get search analytics (admin only)
router.get(
  '/searches',
  validateAnalyticsQuery,
  authenticate,
  requireAdmin,
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: errors.array() });
    }

    const { limit = 50, offset = 0, source, dateFrom, dateTo } = req.query;

    let filteredAnalytics = [...searchAnalytics];

    // Filter by source
    if (source) {
      filteredAnalytics = filteredAnalytics.filter(
        (item) => item.source === source
      );
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredAnalytics = filteredAnalytics.filter(
        (item) => new Date(item.timestamp) >= fromDate
      );
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      filteredAnalytics = filteredAnalytics.filter(
        (item) => new Date(item.timestamp) <= toDate
      );
    }

    // Sort by timestamp (newest first)
    filteredAnalytics.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Apply pagination
    const paginatedAnalytics = filteredAnalytics.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    res.json({
      analytics: paginatedAnalytics,
      total: filteredAnalytics.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  }
);

// Get API usage statistics (admin only)
router.get('/usage', authenticate, requireAdmin, (req, res) => {
  res.json(apiUsage);
});

// Get real-time dashboard data (admin only)
router.get('/dashboard', authenticate, requireAdmin, (req, res) => {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentSearches = searchAnalytics.filter(
    (item) => new Date(item.timestamp) >= last24Hours
  ).length;

  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const hourStart = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

    const searchesInHour = searchAnalytics.filter((item) => {
      const itemTime = new Date(item.timestamp);
      return itemTime >= hourStart && itemTime < hourEnd;
    }).length;

    return {
      hour: hourStart.getHours(),
      searches: searchesInHour,
    };
  });

  res.json({
    recentActivity: {
      last24Hours: recentSearches,
      hourlyData,
    },
    systemHealth: {
      status: 'operational',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: now.toISOString(),
    },
  });
});

// Log search activity (internal use)
const logSearch = (searchData) => {
  const newEntry = {
    id: searchAnalytics.length + 1,
    ...searchData,
    timestamp: new Date(),
  };

  searchAnalytics.push(newEntry);

  // Update usage statistics
  apiUsage.totalSearches++;
  apiUsage.successfulSearches++;

  // Update popular queries
  const queryIndex = apiUsage.popularQueries.findIndex(
    (item) => item.query === searchData.query
  );
  if (queryIndex !== -1) {
    apiUsage.popularQueries[queryIndex].count++;
  } else {
    apiUsage.popularQueries.push({ query: searchData.query, count: 1 });
  }

  // Sort popular queries
  apiUsage.popularQueries.sort((a, b) => b.count - a.count);

  // Update source distribution
  if (apiUsage.sourceDistribution[searchData.source]) {
    apiUsage.sourceDistribution[searchData.source]++;
  }

  // Update average response time
  apiUsage.averageResponseTime =
    (apiUsage.averageResponseTime * (apiUsage.successfulSearches - 1) +
      searchData.responseTime) /
    apiUsage.successfulSearches;
};

// Log failed search (internal use)
const logFailedSearch = (errorData) => {
  apiUsage.totalSearches++;
  apiUsage.failedSearches++;

  logger.warn('Search failed', { errorData });
};

module.exports = {
  router,
  logSearch,
  logFailedSearch,
};
