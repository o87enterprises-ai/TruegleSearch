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

/*
 * IN-MEMORY, PROCESS-LOCAL COUNTERS — NOT A REAL ANALYTICS STORE.
 *
 * This module used to ship SEEDED FAKE DATA: totalSearches started at 1500,
 * with invented "popular queries" and two search rows dated January 2024.
 * logSearch() then incremented on top of that baseline, so every number this
 * endpoint returned was fiction plus a real delta — and anyone reading the
 * admin dashboard, or filling the audience figures on /advertise from it, would
 * have been quoting invented statistics. The seed was removed on 2026-08-24.
 *
 * What remains is honest but deliberately limited: counters start at zero and
 * live only in this process. The backend runs serverless, so they reset on
 * every cold start and each instance sees only its own traffic. Treat them as a
 * live debugging aid, never as a traffic measurement — the response says so
 * itself via `ephemeral: true`.
 *
 * For real numbers use Cloudflare Web Analytics (page views) and Google Search
 * Console (organic impressions/clicks). Wiring this to a database would need a
 * persistent store and a deliberate privacy decision about what may be logged —
 * Truegle does not record user queries against identities.
 */
const PROCESS_STARTED = new Date();

let searchAnalytics = [];

let apiUsage = {
  totalSearches: 0,
  successfulSearches: 0,
  failedSearches: 0,
  averageResponseTime: 0,
  popularQueries: [],
  sourceDistribution: { google: 0, news: 0, youtube: 0, bing: 0 },
};

/** Wraps any payload with the caveats that make these numbers safe to read. */
const withCaveat = (payload) => ({
  ...payload,
  ephemeral: true,
  since: PROCESS_STARTED.toISOString(),
  note:
    'Process-local counters since this instance started; they reset on cold ' +
    'start and cover only this instance. Not a traffic measurement — use ' +
    'Cloudflare Web Analytics or Search Console.',
});

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

    res.json(withCaveat({
      analytics: paginatedAnalytics,
      total: filteredAnalytics.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    }));
  }
);

// Get API usage statistics (admin only)
router.get('/usage', authenticate, requireAdmin, (req, res) => {
  res.json(withCaveat(apiUsage));
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

  res.json(withCaveat({
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
  }));
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
  // successfulSearches was just incremented, so it is >= 1 here; the guard is
  // belt-and-braces against a future caller reordering these updates.
  apiUsage.averageResponseTime = apiUsage.successfulSearches
    ? (apiUsage.averageResponseTime * (apiUsage.successfulSearches - 1) +
        searchData.responseTime) / apiUsage.successfulSearches
    : searchData.responseTime;
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
