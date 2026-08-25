/**
 * Session Management Routes
 * Handles session history wipe ("Nuclear Option")
 * Part of P1 Core Foundation - Session Wipe Feature
 */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/connection');
const logger = require('../utils/logger');
const { privacySafeLog } = require('../middleware/privacy');

/**
 * @route   POST /api/session/wipe
 * @desc    Wipe all ephemeral session data (Nuclear Option)
 * @access  PUBLIC — deliberately. See below.
 */

/* WHY THIS ONE IS NOT BEHIND authenticate.
 *
 * It used to be, and that made it useless for most of the people it exists for.
 * Truegle works with no account: the overwhelming majority of visitors are
 * signed out, they have ephemeral rows on the server like everybody else, and
 * they are the ones most likely to press a button labelled "wipe all data on
 * this device". Requiring a login first inverts the whole point — "prove who
 * you are, then I will forget you."
 *
 * Worse, it failed SILENTLY. The client skipped the server call entirely when
 * it had no token and still rendered the success screen, so a signed-out user
 * was told their server-side ephemeral logs were gone when nothing had been
 * asked to delete them.
 *
 * WHAT MAKES THIS SAFE TO OPEN UP, checked rather than assumed:
 *
 *   • It only ever DELETEs, and only rows keyed to the caller — their own
 *     session token, their own anonymized IP. There is no read path, so it
 *     cannot be used to learn anything.
 *   • Deleting rate_limit_cache is NOT a quota bypass. Nothing reads that
 *     table — the live limiter is express-rate-limit, held in memory — so it
 *     is a record of the caller, not an enforcement mechanism. (If anything
 *     ever starts READING it, this route has to be revisited.)
 *   • A token, if one is sent, is used only as a DELETE key in a parameterized
 *     query. It is never trusted as identity and nothing is returned about it,
 *     so an attacker who guessed one would gain the ability to delete somebody
 *     else's 24-hour ephemeral logs — the thing that data exists to have done
 *     to it.
 *   • wipeLimiter below stops it being used to hammer the database.
 */
const wipeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // a person wipes once; twenty is generous and still not a hammer
  message: {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many wipe requests. Your device data was still cleared locally.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/wipe', wipeLimiter, async (req, res) => {
  // Best-effort only. There is no authenticate middleware in front of this, so
  // this is an unverified string used solely as a DELETE key — never as proof
  // of who is calling.
  const sessionToken = req.headers.authorization?.split(' ')[1] || null;

  try {
    // Track what was wiped for the response
    const wipedData = {
      ephemeralLogs: false,
      rateLimitData: false,
      sessionCache: false,
    };

    // 1. Delete ephemeral logs for this session
    // These are temporary logs created in the last X hours.
    //
    // SKIPPED, not attempted, with no token. `col = NULL` is never true in
    // Postgres so it would delete nothing anyway, but "ran a DELETE that
    // matched nothing" and "had no key to look under" are different facts and
    // the response below reports them differently. Guessing on the client's
    // behalf is how the old version came to claim a wipe that never happened.
    if (!sessionToken) {
      wipedData.ephemeralLogs = 'skipped-no-session';
      wipedData.sessionCache = 'skipped-no-session';
    }
    try {
      if (!sessionToken) throw { code: 'SKIP' };
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
      // Table might not exist yet - that's OK. Neither is SKIP an error.
      if (error.code !== '42P01' && error.code !== 'SKIP') {
        // 42P01 = undefined_table
        logger.warn('Could not wipe ephemeral logs', { error: error.message });
      }
      if (error.code !== 'SKIP') wipedData.ephemeralLogs = true; // nothing to wipe
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

    // 3. Clear any session cache entries (also session-token keyed).
    try {
      if (!sessionToken) throw { code: 'SKIP' };
      const cacheResult = await query(
        `DELETE FROM session_cache
         WHERE session_id = $1
         RETURNING id`,
        [sessionToken]
      );
      wipedData.sessionCache = true;
      wipedData.sessionCacheCount = cacheResult.rowCount || 0;
    } catch (error) {
      // Table might not exist - that's OK. Neither is SKIP an error.
      if (error.code !== '42P01' && error.code !== 'SKIP') {
        logger.warn('Could not wipe session cache', { error: error.message });
      }
      if (error.code !== 'SKIP') wipedData.sessionCache = true; // nothing to wipe
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
      // `authenticated` is reported so the client can say what actually
      // happened rather than showing one success screen for two different
      // outcomes. Signed out, the IP-keyed rows are still wiped; the
      // session-keyed ones had no key to look under and are marked skipped.
      authenticated: !!sessionToken,
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
