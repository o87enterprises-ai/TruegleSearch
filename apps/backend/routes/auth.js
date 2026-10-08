const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const config = require('../config/env');
const User = require('../models/User');
const TokenService = require('../services/TokenService');
const EmailService = require('../services/EmailService');
const logger = require('../utils/logger');

const FRONTEND_URL = config.frontendUrl || 'https://truegle.info';

// ── REMEMBER ME ─────────────────────────────────────────────────────────────
// Owner, 2026-10-08: "add a remember me for the email sign-in so users don't
// have to sign in every time." A remembered sign-in lasts REMEMBER_TTL and is
// RENEWED whenever the app checks it (once a day at most), so someone who keeps
// coming back is never asked again. Not remembered = this browser session only,
// with a short token as the backstop. The token lives in the browser's own
// storage — not a cookie; Truegle still sets none.
const REMEMBER_TTL = '90d';
const SESSION_TTL = '1d';
const RENEW_AFTER_S = 24 * 60 * 60;
const signSession = (user, remember) => jwt.sign(
  { userId: user.id, email: user.email, role: user.role, ...(remember ? { rem: 1 } : {}) },
  config.jwtSecret,
  { expiresIn: remember ? REMEMBER_TTL : SESSION_TTL }
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

    // A remembered sign-in more than a day old gets a fresh 90 days.
    const renewed = decoded.rem && decoded.iat && (Date.now() / 1000 - decoded.iat) > RENEW_AFTER_S
      ? signSession({ id: user.id, email: user.email, role: user.role }, true)
      : null;

    res.json({
      valid: true,
      ...(renewed ? { token: renewed } : {}),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        tokenBalance: tokenBalance.balance,
        isPremium: tokenBalance.isPremium,
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

// ── Direct Registration (email/phone → PayPal → access code) ─────────────────

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

function generateLoginCode() {
  return String(crypto.randomInt(100000, 1000000)); // 6-digit numeric
}

// Durable, reusable per-account code (unambiguous alphabet — no 0/O/1/I).
function generateAccountCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[crypto.randomInt(0, alphabet.length)];
  return out;
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

// ── Passwordless sign-in (free, self-serve "email me a code") ────────────────

/**
 * @route   POST /api/auth/request-code
 * @desc    Email a one-time 6-digit sign-in code. Creates a free account for
 *          this address on first use — no password, no OAuth. Phone/SMS
 *          delivery is not wired up yet ($0 budget); email only for now.
 * @access  Public
 */
router.post('/request-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    const contact = email.trim().toLowerCase();

    const { query } = require('../db/connection');

    // Basic rate limit — don't let one address spam Resend's free tier.
    const recent = await query(
      `SELECT id FROM login_codes WHERE email = $1 AND created_at > NOW() - INTERVAL '60 seconds' LIMIT 1`,
      [contact]
    );
    if (recent.rows.length > 0) {
      return res.status(429).json({ error: 'A code was just sent — please wait a minute before requesting another.' });
    }

    // Find or create (or reactivate an abandoned pending) free account.
    const existing = await query(
      `SELECT id, is_pending FROM users WHERE email = $1 LIMIT 1`,
      [contact]
    );
    let userId;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      if (existing.rows[0].is_pending) {
        await query(`UPDATE users SET is_pending = false, updated_at = NOW() WHERE id = $1`, [userId]);
      }
    } else {
      const created = await query(
        `INSERT INTO users (email, username, registration_method, is_pending, created_at, updated_at)
         VALUES ($1, $2, 'email', false, NOW(), NOW()) RETURNING id`,
        [contact, contact.split('@')[0] || contact]
      );
      userId = created.rows[0].id;
      await TokenService.initializeNewUser(userId);
    }

    const code = generateLoginCode();
    const codeHash = await bcrypt.hash(code, 10);
    await query(
      `INSERT INTO login_codes (email, code_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [contact, codeHash]
    );

    await EmailService.sendLoginCode(contact, code);

    res.json({ success: true, message: 'Code sent — check your email.' });
  } catch (error) {
    logger.error('request-code error', { error: error.message });
    res.status(500).json({ error: 'Could not send code. Please try again.' });
  }
});

/**
 * @route   POST /api/auth/verify-access-code
 * @desc    Exchange a one-time code for a JWT. Checks a paid premium code
 *          (from a completed PayPal purchase) first, then falls back to a
 *          free self-serve login code. Marks whichever one matched as used.
 * @access  Public
 */
router.post('/verify-access-code', async (req, res) => {
  try {
    const { email, phone, code } = req.body;
    // Remembered unless the person unticked it.
    const remember = req.body.remember !== false;
    if (!code || (!email && !phone)) {
      return res.status(400).json({ error: 'Email/phone and access code are required' });
    }
    // 18+ and the terms (the sign-in page's AgeGate), enforced here too: a
    // signed-in account is what unlocks Safe Search "off" (routes/search.js),
    // so the confirmation cannot be skipped by calling the API directly.
    if (req.body.adult !== true) {
      return res.status(400).json({ error: 'Please confirm you are 18 or older to sign in.' });
    }

    const contact = email
      ? email.trim().toLowerCase()
      : phone.trim().replace(/\D/g, '');
    const normalizedCode = code.trim().toUpperCase();

    const { query } = require('../db/connection');

    const userRow = await query(
      `SELECT id, email, username, role, account_code_hash FROM users WHERE email = $1 AND is_pending = false LIMIT 1`,
      [contact]
    );
    if (userRow.rows.length === 0) {
      return res.status(401).json({ error: 'No active account found for that email/phone' });
    }
    const user = userRow.rows[0];

    // Premium codes (from a completed PayPal purchase) take priority.
    const premiumRows = await query(
      `SELECT id, code_hash FROM premium_access_codes
       WHERE user_id = $1 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 5`,
      [user.id]
    );
    let matchedTable = null;
    let matchedId = null;
    for (const row of premiumRows.rows) {
      if (await bcrypt.compare(normalizedCode, row.code_hash)) {
        matchedTable = 'premium_access_codes';
        matchedId = row.id;
        break;
      }
    }

    // Then the durable, reusable account code (works on any device, no email).
    if (!matchedTable && user.account_code_hash) {
      if (await bcrypt.compare(normalizedCode, user.account_code_hash)) {
        matchedTable = 'account_code'; // nothing to mark used — it's reusable
      }
    }

    // Fall back to a free self-serve one-time login code.
    if (!matchedTable) {
      const loginRows = await query(
        `SELECT id, code_hash FROM login_codes
         WHERE email = $1 AND used = false AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 5`,
        [contact]
      );
      for (const row of loginRows.rows) {
        if (await bcrypt.compare(normalizedCode, row.code_hash)) {
          matchedTable = 'login_codes';
          matchedId = row.id;
          break;
        }
      }
    }

    if (!matchedTable) {
      return res.status(401).json({ error: 'Invalid or expired access code' });
    }

    if (matchedTable === 'premium_access_codes') {
      await query(`UPDATE premium_access_codes SET used = true, used_at = NOW() WHERE id = $1`, [matchedId]);
    } else if (matchedTable === 'login_codes') {
      await query(`UPDATE login_codes SET used = true, used_at = NOW() WHERE id = $1`, [matchedId]);
    }

    // First sign-in with no durable code yet? Mint one and reveal it once so
    // the user can save it and sign in on any device without emailing a code.
    let accountCode = null;
    if (!user.account_code_hash) {
      accountCode = generateAccountCode();
      const hash = await bcrypt.hash(accountCode, 10);
      await query(`UPDATE users SET account_code_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, user.id]);
    }

    const tokenBalance = await TokenService.getBalance(user.id);
    const token = signSession(user, remember);

    res.json({
      success: true,
      token,
      remember,
      accountCode, // non-null only on the first-ever sign-in — show it once
      user: {
        id: user.id,
        email: user.email,
        name: user.username,
        role: user.role,
        isPremium: tokenBalance.isPremium,
        tokenBalance: tokenBalance.balance,
      },
    });
  } catch (error) {
    logger.error('verify-access-code error', { error: error.message });
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

/**
 * @route   POST /api/auth/account-code/regenerate
 * @desc    Rotate the caller's durable account code and reveal the new one
 *          once. Invalidates the old code immediately.
 * @access  Private
 */
const { authenticate } = require('../middleware/auth');
router.post('/account-code/regenerate', authenticate, async (req, res) => {
  try {
    const { query } = require('../db/connection');
    const accountCode = generateAccountCode();
    const hash = await bcrypt.hash(accountCode, 10);
    await query(`UPDATE users SET account_code_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, req.user.userId]);
    res.json({ success: true, accountCode });
  } catch (error) {
    logger.error('account-code regenerate error', { error: error.message });
    res.status(500).json({ error: 'Could not regenerate your code. Please try again.' });
  }
});

module.exports = router;
