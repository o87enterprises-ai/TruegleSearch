const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const tokenDenylist = require('../services/tokenDenylist');
const config = require('../config/env');

// THE SAME SECRET THE TOKENS ARE SIGNED WITH. routes/auth.js signs with
// config.jwtSecret, which is TRIMMED (config/env.js); this used to verify
// with the raw process.env.JWT_SECRET. A secret saved with a trailing newline
// then signs one way and verifies another: every sign-in "worked" and was
// rejected a moment later — searches treated as signed out (Safe Search stuck
// on), and the 401 wiped the sign-in (owner, 2026-10-08: "relogin is
// necessary"). One source for both.
const jwtSecret = () => config.jwtSecret;

/**
 * Authentication middleware
 * Verifies JWT tokens for protected routes
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check if token has been revoked (logout denylist)
    if (tokenDenylist.isRevoked(token)) {
      return res.status(401).json({
        error: 'Token revoked',
        message: 'This session has been logged out. Please sign in again.',
      });
    }

    // Verify token - JWT_SECRET is required, no fallback allowed
    if (!jwtSecret()) {
      logger.error('CRITICAL: JWT_SECRET environment variable is not set');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Authentication service is not properly configured',
      });
    }
    const decoded = jwt.verify(token, jwtSecret());

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user',
      isAuthenticated: true,
    };

    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error.message,
      name: error.name,
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please sign in again.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid.',
      });
    }

    res.status(500).json({
      error: 'Authentication failed',
      message: 'Unable to authenticate request.',
    });
  }
};

/**
 * Optional authentication middleware
 * Sets user info if token exists, but doesn't require it
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (
      authHeader &&
      authHeader.startsWith('Bearer ') &&
      jwtSecret()
    ) {
      const token = authHeader.substring(7);
      if (tokenDenylist.isRevoked(token)) {
        req.user = { isAuthenticated: false, role: 'guest' };
        return next();
      }
      const decoded = jwt.verify(token, jwtSecret());

      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user',
        isAuthenticated: true,
      };
    } else {
      req.user = {
        isAuthenticated: false,
        role: 'guest',
      };
    }

    next();
  } catch (error) {
    // If token is invalid, treat as unauthenticated
    req.user = {
      isAuthenticated: false,
      role: 'guest',
    };
    next();
  }
};

/**
 * Admin role requirement middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Administrator privileges required.',
    });
  }
  next();
};

/**
 * Premium user requirement middleware
 * Must be used after authenticate middleware
 */
const requirePremium = async (req, res, next) => {
  try {
    const TokenService = require('../services/TokenService');
    const balance = await TokenService.getBalance(req.user.userId);
    if (!balance.isPremium) {
      return res.status(403).json({
        error: 'Premium required',
        message: 'This feature requires a premium subscription.',
      });
    }
    next();
  } catch (error) {
    logger.error('Premium check failed', { error: error.message });
    res.status(500).json({
      error: 'Authorization check failed',
      message: 'Unable to verify subscription status.',
    });
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin,
  requirePremium,
};
