const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../config/env');
const logger = require('../utils/logger');
const net = require('net');
const { authenticate } = require('../middleware/auth');

// Shodan IP lookup
router.get('/ip/:ip', authenticate, async (req, res) => {
  try {
    const { ip } = req.params;

    // Validate IP parameter
    if (!ip || !net.isIP(ip)) {
      return res.status(400).json({
        error: 'A valid IP address is required'
      });
    }

    // Check if Shodan API key is configured
    if (!config.shodan.apiKey) {
      return res.status(500).json({
        error: 'Shodan API key is not configured'
      });
    }

    // Call the Shodan API for IP information
    const response = await axios.get(`https://api.shodan.io/shodan/host/${ip}`, {
      params: {
        key: config.shodan.apiKey
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error in IP lookup:', error);
    
    res.status(500).json({
      error: 'Failed to get IP information',
      details: 'Service unavailable'
    });
  }
});

// Shodan domain lookup
router.get('/domain/:domain', authenticate, async (req, res) => {
  try {
    const { domain } = req.params;

    // Validate domain parameter
    if (!domain) {
      return res.status(400).json({
        error: 'Domain parameter is required'
      });
    }

    // Check if Shodan API key is configured
    if (!config.shodan.apiKey) {
      return res.status(500).json({
        error: 'Shodan API key is not configured'
      });
    }

    // Call the Shodan API for domain information
    const response = await axios.get(`https://api.shodan.io/dns/domain/${domain}`, {
      params: {
        key: config.shodan.apiKey
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error in domain lookup:', error);
    
    res.status(500).json({
      error: 'Failed to get domain information',
      details: 'Service unavailable'
    });
  }
});

// Shodan search
router.get('/search', authenticate, async (req, res) => {
  try {
    const { query, page = 1, facets } = req.query;

    // Validate query parameter
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    // Check if Shodan API key is configured
    if (!config.shodan.apiKey) {
      return res.status(500).json({
        error: 'Shodan API key is not configured'
      });
    }

    // Prepare query parameters
    const params = {
      key: config.shodan.apiKey,
      query,
      page: parseInt(page)
    };

    if (facets) {
      params.facets = facets;
    }

    // Call the Shodan API for search
    const response = await axios.get('https://api.shodan.io/shodan/host/search', {
      params
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error in Shodan search:', error);
    
    res.status(500).json({
      error: 'Failed to perform Shodan search',
      details: 'Service unavailable'
    });
  }
});

// Get Shodan API info
router.get('/info', authenticate, async (req, res) => {
  try {
    // Check if Shodan API key is configured
    if (!config.shodan.apiKey) {
      return res.status(500).json({
        error: 'Shodan API key is not configured'
      });
    }

    // Call the Shodan API for account information
    const response = await axios.get('https://api.shodan.io/account/profile', {
      params: {
        key: config.shodan.apiKey
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error getting Shodan info:', error);
    
    res.status(500).json({
      error: 'Failed to get Shodan account information',
      details: 'Service unavailable'
    });
  }
});

module.exports = router;