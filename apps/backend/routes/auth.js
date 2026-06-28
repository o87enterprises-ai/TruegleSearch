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

// ── Direct Registration (email/phone → PayPal → access code) ─────────────────

const crypto = require('crypto');
const axios = require('axios');

const PREMIUM_PRICE_USD = '9.99'; // monthly premium access

async function getPayPalToken() {
  const base = process.env.NODE_ENV === 'production'
    ? 'https://api.paypal.com'
    : 'https://api.sandbox.paypal.com';
  const creds = Buffer.from(`${config.paypal.clientId}:${config.paypal.secret}`).toString('base64');
  const r = await axios.post(`${base}/v1/oauth2/token`, 'grant_type=client_credentials', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${creds}` },
  });
  return { token: r.data.access_token, base };
}

function generateAccessCode() {
  return crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
}

/**
 * @route   POST /api/auth/register-direct
 * @desc    Create a pending account and return a PayPal order to complete
 *          registration. No password, no OAuth — just email or phone.
 * @access  Public
 */
router.post('/register-direct', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone number is required' });
    }

    const contact = email
      ? email.trim().toLowerCase()
      : phone.trim().replace(/\D/g, '');

    if (email && !/\S+@\S+\.\S+/.test(contact)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check if non-pending account already exists
    const { query } = require('../db/connection');
    const existing = await query(
      `SELECT id, is_pending FROM users WHERE email = $1 AND is_pending = false LIMIT 1`,
      [contact]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
    }

    // Create or reuse a pending account
    let userId;
    const pending = await query(
      `SELECT id FROM users WHERE email = $1 AND is_pending = true LIMIT 1`,
      [contact]
    );
    if (pending.rows.length > 0) {
      userId = pending.rows[0].id;
    } else {
      const placeholder = await bcrypt.hash(crypto.randomUUID(), 8);
      const newUser = await query(
        `INSERT INTO users (email, password_hash, username, registration_method, is_pending, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW()) RETURNING id`,
        [contact, placeholder, contact.split('@')[0] || contact, email ? 'email' : 'phone']
      );
      userId = newUser.rows[0].id;
    }

    // Create a PayPal Orders API v2 order
    if (!config.paypal?.clientId) {
      return res.status(503).json({ error: 'PayPal not configured on server' });
    }

    const { token, base } = await getPayPalToken();
    const order = await axios.post(`${base}/v2/checkout/orders`, {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'USD', value: PREMIUM_PRICE_USD },
        description: 'Truegle Premium Access — 1 Month',
        custom_id: String(userId),
      }],
      application_context: {
        brand_name: 'Truegle',
        user_action: 'PAY_NOW',
        return_url: `${FRONTEND_URL}/auth/premium-success`,
        cancel_url: `${FRONTEND_URL}/auth/signup`,
      },
    }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });

    // Store the PayPal order ID so we can verify it later
    await query(`UPDATE users SET paypal_order_id = $1 WHERE id = $2`, [order.data.id, userId]);

    res.json({
      success: true,
      orderId: order.data.id,
      userId,
      amount: PREMIUM_PRICE_USD,
    });
  } catch (error) {
    logger.error('register-direct error', { error: error.message });
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * @route   POST /api/auth/confirm-premium
 * @desc    Capture PayPal order after user approves it, activate the account,
 *          and return a one-time access code.
 * @access  Public
 */
router.post('/confirm-premium', async (req, res) => {
  try {
    const { orderId, userId } = req.body;
    if (!orderId || !userId) {
      return res.status(400).json({ error: 'orderId and userId are required' });
    }

    const { query } = require('../db/connection');

    // Verify the orderId belongs to this userId
    const userRow = await query(
      `SELECT id, email, is_pending FROM users WHERE id = $1 AND paypal_order_id = $2 LIMIT 1`,
      [userId, orderId]
    );
    if (userRow.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid order or user mismatch' });
    }

    // Capture the PayPal order
    const { token, base } = await getPayPalToken();
    const capture = await axios.post(
      `${base}/v2/checkout/orders/${orderId}/capture`,
      {},
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
    );

    if (capture.data.status !== 'COMPLETED') {
      return res.status(402).json({ error: 'Payment not completed', status: capture.data.status });
    }

    // Activate the account and grant premium
    const code = generateAccessCode();
    const codeHash = await bcrypt.hash(code, 10);

    await query(
      `UPDATE users
       SET is_pending = false, is_verified = true, subscription_tier = 'premium',
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    await query(
      `INSERT INTO premium_access_codes (user_id, code_hash) VALUES ($1, $2)`,
      [userId, codeHash]
    );
    await TokenService.initializeNewUser(userId);

    logger.info('Premium account activated', { userId, orderId });

    res.json({
      success: true,
      accessCode: code,
      message: 'Payment confirmed! Copy your access code — use it to sign in on any device.',
    });
  } catch (error) {
    logger.error('confirm-premium error', { error: error.message });
    res.status(500).json({ error: 'Failed to confirm payment. Contact support with your PayPal receipt.' });
  }
});

/**
 * @route   POST /api/auth/verify-access-code
 * @desc    Exchange a one-time access code for a JWT. Marks the code used.
 * @access  Public
 */
router.post('/verify-access-code', async (req, res) => {
  try {
    const { email, phone, code } = req.body;
    if (!code || (!email && !phone)) {
      return res.status(400).json({ error: 'Email/phone and access code are required' });
    }

    const contact = email
      ? email.trim().toLowerCase()
      : phone.trim().replace(/\D/g, '');

    const { query } = require('../db/connection');

    const userRow = await query(
      `SELECT id, email, username, role FROM users WHERE email = $1 AND is_pending = false LIMIT 1`,
      [contact]
    );
    if (userRow.rows.length === 0) {
      return res.status(401).json({ error: 'No active account found for that email/phone' });
    }
    const user = userRow.rows[0];

    // Find an unused, non-expired code for this user
    const codeRows = await query(
      `SELECT id, code_hash FROM premium_access_codes
       WHERE user_id = $1 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 5`,
      [user.id]
    );

    let matched = null;
    for (const row of codeRows.rows) {
      const ok = await bcrypt.compare(code.trim().toUpperCase(), row.code_hash);
      if (ok) { matched = row; break; }
    }

    if (!matched) {
      return res.status(401).json({ error: 'Invalid or expired access code' });
    }

    // Mark code as used
    await query(
      `UPDATE premium_access_codes SET used = true, used_at = NOW() WHERE id = $1`,
      [matched.id]
    );

    const tokenBalance = await TokenService.getBalance(user.id);
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.username,
        role: user.role,
        isPremium: true,
        tokenBalance: tokenBalance.balance,
      },
    });
  } catch (error) {
    logger.error('verify-access-code error', { error: error.message });
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

module.exports = router;
