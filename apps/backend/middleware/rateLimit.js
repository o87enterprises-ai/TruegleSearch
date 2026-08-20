const rateLimit = require('express-rate-limit');
const { getClientIp } = require('./botDetection');

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
    // Use user ID if authenticated, otherwise the real client IP
    // (Cloudflare-aware, falls back to req.ip).
    return req.user && req.user.userId ? req.user.userId : getClientIp(req);
  },
});

/**
 * The published ceiling for declared API clients.
 *
 * A request carrying `X-Truegle-Client` skips the scraper block and the
 * suspicious-client throttle, so without this it would arrive with only the
 * global 500-per-15-minutes to slow it down — and /developers promises a
 * per-minute limit. This is that promise.
 *
 * SCOPED TO DECLARED CLIENTS ONLY, deliberately. The obvious alternative was
 * to put the existing `searchLimiter` on /api/search for everybody, but
 * /api/search currently has no per-minute limit at all, and quietly imposing
 * one would change behaviour for every visitor on a shared or office IP to fix
 * a problem none of them have. Additive here, nothing existing moves.
 */
const apiClientLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => !(req.botInfo && req.botInfo.isDeclaredClient),
  message: {
    error: 'Rate limit exceeded',
    message:
      'The public API allows 30 searches per minute. Back off and retry rather '
      + 'than retrying immediately — see https://truegle.info/developers.',
  },
});

/**
 * Bot-aware limiter for the search API. Only counts requests flagged as
 * suspicious by botDetection — normal users skip it entirely — so a scraper
 * that slips past UA-based blocking still hits a hard, low ceiling.
 */
const suspiciousBotLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => !(req.botInfo && req.botInfo.suspicious),
  message: {
    error: 'Rate limit exceeded',
    message:
      'Unusual request pattern detected. If you are a person, please try again shortly.',
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
    return req.user ? req.user.userId : getClientIp(req);
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
      return req.user ? req.user.userId : getClientIp(req);
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
  suspiciousBotLimiter,
  apiClientLimiter,
};
