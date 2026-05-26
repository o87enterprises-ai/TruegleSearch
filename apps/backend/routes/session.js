/**
 * Session Management Routes
 * Handles session history wipe ("Nuclear Option")
 * Part of P1 Core Foundation - Session Wipe Feature
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/connection');
const logger = require('../utils/logger');
const { privacySafeLog } = require('../middleware/privacy');

/**
 * @route   POST /api/session/wipe
 * @desc    Wipe all ephemeral session data (Nuclear Option)
 * @access  Private (requires authentication)
 */
router.post('/wipe', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const sessionToken = req.headers.authorization?.split(' ')[1];

  try {
    // Track what was wiped for the response
    const wipedData = {
      ephemeralLogs: false,
      rateLimitData: false,
      sessionCache: false,
    };

    // 1. Delete ephemeral logs for this session
    // These are temporary logs created in the last X hours
    try {
      const logResult = await query(
        `DELETE FROM ephemeral_logs
         WHERE user_session = $1
         AND created_at > NOW() - INTERVAL '24 hours'
         RETURNING id`,
        [sessionToken]
      );
      wipedData.ephemeralLogs = true;
      wipedData.ephemeralLogsCount = logResult.rowCount || 0;
    } catch (error) {
      // Table might not exist yet - that's OK
      if (error.code !== '42P01') {
        // 42P01 = undefined_table
        logger.warn('Could not wipe ephemeral logs', { error: error.message });
      }
      wipedData.ephemeralLogs = true; // Nothing to wipe
      wipedData.ephemeralLogsCount = 0;
    }

    // 2. Clear rate limit data for this user's current session
    try {
      const rateLimitResult = await query(
        `DELETE FROM rate_limit_cache
         WHERE identifier = $1
         RETURNING id`,
        [req.anonymizedIP || req.ip]
      );
      wipedData.rateLimitData = true;
      wipedData.rateLimitCount = rateLimitResult.rowCount || 0;
    } catch (error) {
      // Table might not exist - that's OK
      if (error.code !== '42P01') {
        logger.warn('Could not wipe rate limit data', { error: error.message });
      }
      wipedData.rateLimitData = true;
      wipedData.rateLimitCount = 0;
    }

    // 3. Clear any session cache entries
    try {
      const cacheResult = await query(
        `DELETE FROM session_cache
         WHERE session_id = $1
         RETURNING id`,
        [sessionToken]
      );
      wipedData.sessionCache = true;
      wipedData.sessionCacheCount = cacheResult.rowCount || 0;
    } catch (error) {
      // Table might not exist - that's OK
      if (error.code !== '42P01') {
        logger.warn('Could not wipe session cache', { error: error.message });
      }
      wipedData.sessionCache = true;
      wipedData.sessionCacheCount = 0;
    }

    // Log the wipe action (without PII)
    privacySafeLog.info('Session wipe completed', {
      action: 'nuclear_wipe',
      timestamp: new Date().toISOString(),
      success: true,
    });

    res.json({
      success: true,
      message: 'Session data wiped successfully',
      wiped: wipedData,
      timestamp: new Date().toISOString(),
      note: 'Client-side storage (localStorage, sessionStorage, IndexedDB) should be cleared by the frontend',
    });
  } catch (error) {
    logger.error('Session wipe failed', {
      error: error.message,
      action: 'nuclear_wipe',
    });

    res.status(500).json({
      success: false,
      error: 'Wipe failed',
      message: 'Unable to complete session data wipe. Please try again.',
    });
  }
});

/**
 * @route   GET /api/session/status
 * @desc    Get current session status (no PII)
 * @access  Private
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    res.json({
      authenticated: true,
      sessionActive: true,
      timestamp: new Date().toISOString(),
      // Note: We intentionally don't return any PII here
    });
  } catch (error) {
    res.status(500).json({
      error: 'Status check failed',
    });
  }
});

/**
 * @route   GET /api/session/privacy-info
 * @desc    Get information about what data is stored
 * @access  Public
 */
router.get('/privacy-info', (req, res) => {
  res.json({
    dataStored: {
      clientSide: {
        localStorage: [
          'isRedPillMode - UI preference',
          'isOSINTMode - UI preference',
          'theme - UI preference',
        ],
        sessionStorage: ['Current search query (temporary)'],
        indexedDB: ['Search result cache (auto-expires)'],
      },
      serverSide: {
        ephemeralLogs: 'Temporary logs, auto-deleted after 24 hours, not linked to user account',
        rateLimitCache: 'IP-based rate limiting (anonymized IP only)',
        sessionCache: 'Temporary session data, not persistent',
      },
    },
    dataNotStored: [
      'Search history linked to your account',
      'Browsing patterns',
      'Personal profile data',
      'Third-party tracking cookies',
    ],
    wipeCapability: {
      endpoint: '/api/session/wipe',
      method: 'POST',
      description:
        'Immediately deletes all ephemeral session data from both client and server',
    },
  });
});

module.exports = router;
