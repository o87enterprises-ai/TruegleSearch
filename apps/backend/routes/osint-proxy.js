const express = require('express');
const axios = require('axios');
const router = express.Router();
const { authenticate, requirePremium } = require('../middleware/auth');
const logger = require('../utils/logger');

const OSINT_SERVICE_URL = process.env.OSINT_SERVICE_URL || 'http://localhost:5000';
const OSINT_TIMEOUT = 60000; // 60s — OSINT operations can be slow

// All OSINT proxy routes require authentication + premium
router.use(authenticate, requirePremium);

/**
 * @route   POST /api/osint-tools/analyze/phone
 * @desc    Analyze a phone number via OSINT service
 * @access  Premium
 */
router.post('/analyze/phone', async (req, res) => {
  try {
    const { phone, first_name } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }

    // Basic phone number format validation
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    if (!/^\+?\d{7,15}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const response = await axios.post(
      `${OSINT_SERVICE_URL}/analyze/phone`,
      { phone: cleanPhone, first_name: first_name || undefined },
      { timeout: OSINT_TIMEOUT }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    logger.error('OSINT phone analysis failed', { error: error.message });
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'OSINT service is unavailable' });
    }
    res.status(500).json({ error: 'Phone analysis failed', details: 'Service unavailable' });
  }
});

/**
 * @route   POST /api/osint-tools/analyze/text
 * @desc    Analyze text content for harassment via OSINT service
 * @access  Premium
 */
router.post('/analyze/text', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    if (text.length > 50000) {
      return res.status(400).json({ error: 'Text content exceeds maximum length (50,000 characters)' });
    }

    const response = await axios.post(
      `${OSINT_SERVICE_URL}/analyze/text`,
      { text: text.trim() },
      { timeout: OSINT_TIMEOUT }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    logger.error('OSINT text analysis failed', { error: error.message });
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'OSINT service is unavailable' });
    }
    res.status(500).json({ error: 'Text analysis failed', details: 'Service unavailable' });
  }
});

/**
 * @route   POST /api/osint-tools/analyze/username
 * @desc    Analyze username across platforms via OSINT service
 * @access  Premium
 */
router.post('/analyze/username', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Basic username sanitization
    const cleanUsername = username.trim().replace(/[^\w\.\-]/g, '');
    if (cleanUsername.length < 2 || cleanUsername.length > 64) {
      return res.status(400).json({ error: 'Username must be 2-64 characters (alphanumeric, dots, hyphens, underscores)' });
    }

    const response = await axios.post(
      `${OSINT_SERVICE_URL}/analyze/username`,
      { username: cleanUsername },
      { timeout: OSINT_TIMEOUT }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    logger.error('OSINT username analysis failed', { error: error.message });
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'OSINT service is unavailable' });
    }
    res.status(500).json({ error: 'Username analysis failed', details: 'Service unavailable' });
  }
});

/**
 * @route   GET /api/osint-tools/health
 * @desc    Check OSINT service availability
 * @access  Premium
 */
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(OSINT_SERVICE_URL, { timeout: 5000 });
    res.json({ success: true, status: 'available' });
  } catch (error) {
    res.json({ success: false, status: 'unavailable' });
  }
});

module.exports = router;
