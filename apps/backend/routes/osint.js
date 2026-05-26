const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../config/env');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');

// OSINT search using Hunter.io API
router.get('/email-finder', authenticate, async (req, res) => {
  try {
    const { domain, company, firstName, lastName } = req.query;

    // Validate required parameters
    if (!domain && !company) {
      return res.status(400).json({
        error: 'Either domain or company parameter is required'
      });
    }

    // Check if Hunter.io API key is configured
    if (!config.hunterIo.apiKey) {
      return res.status(500).json({
        error: 'Hunter.io API key is not configured'
      });
    }

    // Prepare query parameters
    const params = {
      domain,
      company,
      first_name: firstName,
      last_name: lastName,
      api_key: config.hunterIo.apiKey
    };

    // Clean up undefined parameters
    Object.keys(params).forEach(key => {
      if (params[key] === undefined) {
        delete params[key];
      }
    });

    // Call the Hunter.io API
    const response = await axios.get('https://api.hunter.io/v2/domain-search', {
      params
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error in email finder:', error);
    
    res.status(500).json({
      error: 'Failed to perform email search',
      details: 'Service unavailable'
    });
  }
});

// Email verification endpoint
router.get('/email-verifier', authenticate, async (req, res) => {
  try {
    const { email } = req.query;

    // Validate required parameters
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        error: 'A valid email address is required'
      });
    }

    // Check if Hunter.io API key is configured
    if (!config.hunterIo.apiKey) {
      return res.status(500).json({
        error: 'Hunter.io API key is not configured'
      });
    }

    // Call the Hunter.io API for email verification
    const response = await axios.get('https://api.hunter.io/v2/email-verifier', {
      params: {
        email,
        api_key: config.hunterIo.apiKey
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error in email verifier:', error);
    
    res.status(500).json({
      error: 'Failed to verify email',
      details: 'Service unavailable'
    });
  }
});

// Get account information
router.get('/account-info', authenticate, async (req, res) => {
  try {
    // Check if Hunter.io API key is configured
    if (!config.hunterIo.apiKey) {
      return res.status(500).json({
        error: 'Hunter.io API key is not configured'
      });
    }

    // Call the Hunter.io API to get account information
    const response = await axios.get('https://api.hunter.io/v2/account', {
      params: {
        api_key: config.hunterIo.apiKey
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error getting account info:', error);
    
    res.status(500).json({
      error: 'Failed to get account information',
      details: 'Service unavailable'
    });
  }
});

module.exports = router;