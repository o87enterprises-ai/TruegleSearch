const rateLimit = require('express-rate-limit');

/**
 * General rate limiter for all API endpoints
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased limit for map-heavy usage
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for OPTIONS (CORS preflight) and health checks
    // Maps/Radar use their own dedicated limiter
    return (
      req.method === 'OPTIONS' ||
      req.path === '/api/health' ||
      req.path === '/api/search/health' ||
      req.path.startsWith('/api/maps/') ||
      req.path.startsWith('/api/radar/')
    );
  },
});

/**
 * Strict rate limiter for search endpoints
 */
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 search requests per minute
  message: {
    error: 'Search rate limit exceeded',
    message:
      'Too many search requests. Please wait a moment before searching again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP address
    return req.user && req.user.userId ? req.user.userId : req.ip;
  },
});

/**
 * Authentication rate limiter to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many login attempts',
    message: 'Too many failed login attempts. Please try again later.',
  },
  skipSuccessfulRequests: true, // Only count failed attempts
});

/**
 * API key creation rate limiter
 */
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each user to 3 API key creations per hour
  message: {
    error: 'Too many API key requests',
    message: 'Please wait before creating more API keys.',
  },
  keyGenerator: (req) => {
    return req.user ? req.user.userId : req.ip;
  },
});

/**
 * Custom search rate limiting middleware
 * Applies different limits based on user status
 */
const rateLimitSearch = (req, res, next) => {
  // Apply different limits based on user status
  if (req.user && req.user.role === 'premium') {
    // Premium users get higher limits
    req.rateLimit = {
      windowMs: 1 * 60 * 1000,
      max: 60, // 60 requests per minute for premium users
    };
  } else if (req.user && req.user.isAuthenticated) {
    // Authenticated regular users
    req.rateLimit = {
      windowMs: 1 * 60 * 1000,
      max: 30, // 30 requests per minute
    };
  } else {
    // Guest users
    req.rateLimit = {
      windowMs: 1 * 60 * 1000,
      max: 10, // 10 requests per minute for guests
    };
  }

  next();
};

/**
 * Rate limit by user tier
 */
const tieredLimiter = (tier = 'free') => {
  const limits = {
    free: { windowMs: 60000, max: 10 },
    basic: { windowMs: 60000, max: 30 },
    premium: { windowMs: 60000, max: 100 },
    enterprise: { windowMs: 60000, max: 1000 },
  };

  const config = limits[tier] || limits.free;

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: 'Rate limit exceeded',
      message: `Your ${tier} tier allows ${config.max} requests per minute. Please upgrade for higher limits.`,
    },
    keyGenerator: (req) => {
      return req.user ? req.user.userId : req.ip;
    },
  });
};

/**
 * Rate limiter for maps and radar endpoints
 */
const mapsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many map requests. Please try again shortly.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

module.exports = {
  generalLimiter,
  searchLimiter,
  authLimiter,
  apiKeyLimiter,
  rateLimitSearch,
  tieredLimiter,
  mapsLimiter,
};
