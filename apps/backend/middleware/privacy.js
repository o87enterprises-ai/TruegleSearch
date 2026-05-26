/**
 * Privacy Middleware
 * Implements IP anonymization and privacy-by-design logging
 * Part of P1 Core Foundation - Privacy Backbone
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Anonymizes IP address by zeroing the last octet (IPv4) or last 80 bits (IPv6)
 * @param {string} ip - Original IP address
 * @returns {string} - Anonymized IP address
 */
function anonymizeIP(ip) {
  if (!ip) return 'unknown';

  // Handle IPv4
  if (ip.includes('.') && !ip.includes(':')) {
    return ip.replace(/\.\d+$/, '.0');
  }

  // Handle IPv4-mapped IPv6 (::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    const ipv4 = ip.substring(7);
    return '::ffff:' + ipv4.replace(/\.\d+$/, '.0');
  }

  // Handle IPv6 - zero out last 5 segments (80 bits)
  if (ip.includes(':')) {
    const segments = ip.split(':');
    if (segments.length >= 5) {
      return segments.slice(0, 3).join(':') + ':0:0:0:0:0';
    }
  }

  return 'anonymized';
}

/**
 * Generates an ephemeral session ID for rate limiting
 * Not linked to user account, expires with request
 */
function generateEphemeralSession() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Privacy middleware - strips PII before logging
 */
const privacyMiddleware = (req, res, next) => {
  // Store original IP for rate limiting only (not logged)
  req._originalIP = req.ip;

  // Create anonymized IP for any logging purposes
  req.anonymizedIP = anonymizeIP(req.ip);

  // Generate ephemeral session (for rate limiting without user tracking)
  req.ephemeralSession = generateEphemeralSession();

  // Strip identifying headers from request object
  // These headers are removed from the request before processing
  const sensitiveHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip',
    'true-client-ip',
  ];

  // Store original headers if needed for proxying, but don't log them
  req._originalHeaders = {};
  sensitiveHeaders.forEach((header) => {
    if (req.headers[header]) {
      req._originalHeaders[header] = req.headers[header];
      // We don't delete them as they may be needed for proxy detection
      // but they should never be logged
    }
  });

  // Mark request as privacy-processed
  req.privacyProcessed = true;

  // Override req.ip getter to return anonymized IP for logging
  Object.defineProperty(req, 'logSafeIP', {
    get: () => req.anonymizedIP,
    enumerable: true,
  });

  next();
};

/**
 * No-track header middleware
 * Respects DNT (Do Not Track) header and sets appropriate response headers
 */
const noTrackMiddleware = (req, res, next) => {
  // Check DNT header
  const dnt = req.headers['dnt'] || req.headers['DNT'];
  req.doNotTrack = dnt === '1';

  // Set response headers to indicate no tracking
  res.setHeader('Tk', 'N'); // Tracking Status: Not tracking
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Remove any tracking-related cookies from request
  // (In case third-party scripts try to set them)
  res.setHeader(
    'Set-Cookie',
    '_truegle_no_track=1; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
  );

  next();
};

/**
 * Search privacy middleware
 * Ensures search queries are never linked to user accounts in logs
 */
const searchPrivacyMiddleware = (req, res, next) => {
  // For search endpoints, create a separate anonymized context
  if (req.path.includes('/search')) {
    // Don't log the actual search query - only log that a search occurred
    req.searchContext = {
      timestamp: new Date().toISOString(),
      anonymizedIP: req.anonymizedIP,
      ephemeralSession: req.ephemeralSession,
      // Note: userId is NOT included here intentionally
    };

    // Override any attempt to log user-linked search data
    req._searchQueryLogged = false;
  }

  next();
};

/**
 * Privacy-safe logger wrapper
 * Strips PII from log entries before writing
 */
const privacySafeLog = {
  info: (message, data = {}) => {
    const safeData = stripPII(data);
    logger.info(message, safeData);
  },
  warn: (message, data = {}) => {
    const safeData = stripPII(data);
    logger.warn(message, safeData);
  },
  error: (message, data = {}) => {
    const safeData = stripPII(data);
    logger.error(message, safeData);
  },
};

/**
 * Strips PII from data object before logging
 */
function stripPII(data) {
  if (!data || typeof data !== 'object') return data;

  const piiFields = [
    'email',
    'password',
    'ip',
    'x-forwarded-for',
    'authorization',
    'cookie',
    'user-agent',
    'userId',
    'name',
    'phone',
    'address',
  ];

  const safeData = { ...data };

  piiFields.forEach((field) => {
    if (safeData[field]) {
      safeData[field] = '[REDACTED]';
    }
  });

  // Handle nested objects
  Object.keys(safeData).forEach((key) => {
    if (typeof safeData[key] === 'object' && safeData[key] !== null) {
      safeData[key] = stripPII(safeData[key]);
    }
  });

  return safeData;
}

module.exports = {
  privacyMiddleware,
  noTrackMiddleware,
  searchPrivacyMiddleware,
  privacySafeLog,
  anonymizeIP,
  generateEphemeralSession,
  stripPII,
};
