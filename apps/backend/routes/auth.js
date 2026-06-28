const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const router = express.Router();
const config = require('../config/env');
const User = require('../models/User');
const TokenService = require('../services/TokenService');
const logger = require('../utils/logger');

// ── Google OAuth Strategy ────────────────────────────────────────────────────
// Prefer an explicit, STABLE backend URL for the OAuth callback. process.env
// VERCEL_URL is the per-deployment hostname (changes every deploy), which would
// never match Google's registered redirect URI — so it's only the last resort.
// VERCEL_PROJECT_PRODUCTION_URL is Vercel's system env for the stable production
// alias (e.g. backend-seven-khaki-60.vercel.app). Unlike VERCEL_URL it never
// changes between deployments, so the callbackURL always matches Google's registered URI.
const BACKEND_URL = process.env.BACKEND_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');

const FRONTEND_URL = config.frontendUrl || 'https://truegle.info';

if (config.googleOAuth && config.googleOAuth.clientId) {
  passport.use(new GoogleStrategy({
    clientID: config.googleOAuth.clientId,
    clientSecret: config.googleOAuth.clientSecret,
    callbackURL: `${BACKEND_URL}/api/auth/google/callback`,
    scope: ['profile', 'email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('No email from Google'), null);

      let user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        user = new User({
          email: email.toLowerCase(),
          name: profile.displayName || email.split('@')[0],
          password: await bcrypt.hash(Math.random().toString(36), 12),
          role: 'user',
          isVerified: true,
          googleId: profile.id,
        });
        await user.save();
        await TokenService.initializeNewUser(user.id);
      } else if (!user.googleId) {
        user.googleId = profile.id;
        user.isVerified = true;
        await user.save();
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
}

// Helper to issue JWT + redirect to frontend
function issueTokenAndRedirect(user, res) {
  TokenService.getBalance(user.id).then(tokenBalance => {
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, googleVerified: !!user.googleId },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    const params = new URLSearchParams({
      token,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tokenBalance: tokenBalance.balance,
      isPremium: tokenBalance.isPremium,
      googleVerified: !!user.googleId,
    });
    res.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
  }).catch(() => {
    res.redirect(`${FRONTEND_URL}/auth/login?error=oauth_failed`);
  });
}

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
    body('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters'),
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: errors.array()[0]?.msg || 'Invalid input',
          details: errors.array(),
        });
      }

      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        email: email.toLowerCase().trim(),
      });
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'A user with this email already exists',
        });
      }

      // Hash password before saving
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create new user
      const newUser = new User({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        role: 'user',
        isVerified: false,
      });

      const savedUser = await newUser.save();

      // Initialize tokens for new user
      await TokenService.initializeNewUser(savedUser.id);
      const tokenBalance = await TokenService.getBalance(savedUser.id);

      // Generate JWT token
      const token = jwt.sign(
        { userId: savedUser.id, email: savedUser.email, role: savedUser.role, googleVerified: false },
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: savedUser.id,
          email: savedUser.email,
          name: savedUser.name,
          role: savedUser.role,
          tokenBalance: tokenBalance.balance,
          isPremium: tokenBalance.isPremium,
          googleVerified: false,
        },
        token,
        expiresIn: 86400, // 24 hours in seconds
      });
    } catch (error) {
      logger.logError(error, req, { action: 'registration' });
      res.status(500).json({
        error: 'Registration failed',
        message: 'Unable to create user account',
      });
    }
  }
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
    body('password').exists().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: errors.array()[0]?.msg || 'Invalid input',
          details: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({
        email: email.toLowerCase().trim(),
      });
      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password',
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password',
        });
      }

      // Update last login
      await user.updateLastLogin();

      // Get token balance
      const tokenBalance = await TokenService.getBalance(user.id);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, googleVerified: !!user.googleId },
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
          tokenBalance: tokenBalance.balance,
          isPremium: tokenBalance.isPremium,
          googleVerified: !!user.googleId,
        },
        token,
        expiresIn: 86400, // 24 hours in seconds
      });
    } catch (error) {
      logger.logError(error, req, { action: 'login' });
      res.status(500).json({
        error: 'Login failed',
        message: 'Unable to authenticate user',
      });
    }
  }
);

/**
 * @route   GET /api/auth/validate
 * @desc    Validate JWT token and return user
 * @access  Private
 */
router.get('/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    // Check denylist
    const tokenDenylist = require('../services/tokenDenylist');
    if (tokenDenylist.isRevoked(token)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'This session has been logged out',
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Get token balance
    const tokenBalance = await TokenService.getBalance(user.id);

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        tokenBalance: tokenBalance.balance,
        isPremium: tokenBalance.isPremium,
        googleVerified: !!user.googleId,
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
    logger.logError(error, req, { action: 'validate' });
    res.status(500).json({
      error: 'Validation failed',
      message: 'Unable to validate token',
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and revoke JWT token
 * @access  Private
 */
router.post('/logout', (req, res) => {
  const tokenDenylist = require('../services/tokenDenylist');
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    tokenDenylist.add(token);
  }
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth flow
 */
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback — issues JWT and redirects to frontend
 */
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/auth/login?error=google_failed` }),
  (req, res) => issueTokenAndRedirect(req.user, res)
);

module.exports = router;
