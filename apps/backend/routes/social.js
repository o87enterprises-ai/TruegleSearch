const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../config/env');
const logger = require('../utils/logger');

// Social media search using Apify API
router.post('/search', async (req, res) => {
  try {
    const { query, platform = 'all', limit = 10 } = req.body;

    // Validate required parameters
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    // Check if Apify API key is configured
    if (!config.apify.apiKey) {
      return res.status(500).json({
        error: 'Apify API key is not configured'
      });
    }

    // Determine the Apify actor based on platform
    let actorId;
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        actorId = 'apify/twitter-scraper';
        break;
      case 'instagram':
        actorId = 'apify/instagram-scraper';
        break;
      case 'facebook':
        actorId = 'apify/facebook-scraper';
        break;
      case 'linkedin':
        actorId = 'apify/linkedin-scraper';
        break;
      case 'youtube':
        actorId = 'apify/youtube-scraper';
        break;
      case 'tiktok':
        actorId = 'apify/tiktok-scraper';
        break;
      default:
        // Use a generic social media scraper or aggregate multiple platforms
        actorId = 'apify/social-media-scraper'; // Placeholder - adjust based on actual Apify actors
    }

    // Prepare the input for the Apify actor
    const input = {
      search: query,
      maxItems: parseInt(limit),
      // Additional parameters can be added based on the specific actor
    };

    // Call the Apify API
    const response = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs`,
      input,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apify.apiKey}`
        },
        params: {
          token: config.apify.apiKey
        }
      }
    );

    // Return the job ID for the user to poll for results
    res.status(200).json({
      success: true,
      jobId: response.data.data.id,
      status: response.data.data.status,
      message: 'Social media search initiated successfully. Use the jobId to fetch results.'
    });

  } catch (error) {
    logger.error('Error in social media search:', error);
    
    res.status(500).json({
      error: 'Failed to initiate social media search',
      details: 'Service unavailable'
    });
  }
});

// Endpoint to get results from a previously initiated Apify job
router.get('/results/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        error: 'Job ID is required'
      });
    }

    // Check if Apify API key is configured
    if (!config.apify.apiKey) {
      return res.status(500).json({
        error: 'Apify API key is not configured'
      });
    }

    // Get the job status and results
    const jobResponse = await axios.get(
      `https://api.apify.com/v2/acts/runs/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apify.apiKey}`
        },
        params: {
          token: config.apify.apiKey
        }
      }
    );

    const jobStatus = jobResponse.data.data.status;
    const results = {};

    if (jobStatus === 'SUCCEEDED') {
      // Get the dataset ID to fetch results
      const datasetId = jobResponse.data.data.defaultDatasetId;
      
      if (datasetId) {
        const datasetResponse = await axios.get(
          `https://api.apify.com/v2/datasets/${datasetId}/items`,
          {
            headers: {
              'Authorization': `Bearer ${config.apify.apiKey}`
            },
            params: {
              token: config.apify.apiKey
            }
          }
        );
        
        results.items = datasetResponse.data;
      }
    }

    res.status(200).json({
      success: true,
      jobId,
      status: jobStatus,
      results
    });

  } catch (error) {
    logger.error('Error fetching social media results:', error);
    
    res.status(500).json({
      error: 'Failed to fetch social media search results',
      details: 'Service unavailable'
    });
  }
});

// Alternative endpoint for direct social media search (if available)
router.post('/direct-search', async (req, res) => {
  try {
    const { query, platform = 'all', limit = 10 } = req.body;

    // Validate required parameters
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    // Check if Apify API key is configured
    if (!config.apify.apiKey) {
      return res.status(500).json({
        error: 'Apify API key is not configured'
      });
    }

    // For this implementation, we'll use the Twitter/X scraper as an example
    // In a real implementation, you'd want to dynamically select the appropriate actor
    const actorId = 'apify/twitter-scraper'; // Adjust as needed
    
    const input = {
      searches: [
        {
          phrase: query
        }
      ],
      maxItems: parseInt(limit),
      // Additional parameters can be added based on requirements
    };

    // Call the Apify API synchronously (with timeout)
    const response = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs?waitSecs=60`, // Wait up to 60 seconds
      input,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apify.apiKey}`
        },
        params: {
          token: config.apify.apiKey
        }
      }
    );

    // Extract results if available
    let results = [];
    if (response.data.data && response.data.data.defaultDatasetId) {
      const datasetId = response.data.data.defaultDatasetId;
      
      const datasetResponse = await axios.get(
        `https://api.apify.com/v2/datasets/${datasetId}/items`,
        {
          headers: {
            'Authorization': `Bearer ${config.apify.apiKey}`
          },
          params: {
            token: config.apify.apiKey
          }
        }
      );
      
      results = datasetResponse.data;
    }

    res.status(200).json({
      success: true,
      results,
      count: results.length
    });

  } catch (error) {
    logger.error('Error in direct social media search:', error);
    
    res.status(500).json({
      error: 'Failed to perform social media search',
      details: 'Service unavailable'
    });
  }
});

module.exports = router;