const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../config/env');
const logger = require('../utils/logger');

// Search for photos on Unsplash
router.get('/search', async (req, res) => {
  try {
    const { query, page = 1, perPage = 10, orientation, color, contentFilter } = req.query;

    // Validate required parameters
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    // Check if Unsplash API keys are configured
    if (!config.unsplash || !config.unsplash.accessKey) {
      return res.status(500).json({
        error: 'Unsplash API keys are not configured'
      });
    }

    // Prepare query parameters for Unsplash API
    const params = {
      query,
      page: parseInt(page),
      per_page: parseInt(perPage),
      client_id: config.unsplash.accessKey
    };

    // Add optional parameters if provided
    if (orientation) params.orientation = orientation;
    if (color) params.color = color;
    if (contentFilter) params.content_filter = contentFilter;

    // Call the Unsplash Search Photos API
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params,
      timeout: 8000,
    });

    res.status(200).json({
      success: true,
      results: response.data.results,
      total: response.data.total,
      totalPages: Math.ceil(response.data.total / perPage),
      currentPage: parseInt(page)
    });

  } catch (error) {
    logger.error('Error in Unsplash search:', error);
    
    res.status(500).json({
      error: 'Failed to search Unsplash photos',
      details: 'Service unavailable'
    });
  }
});

// Get a random photo from Unsplash
router.get('/random', async (req, res) => {
  try {
    // Check if Unsplash API keys are configured
    if (!config.unsplash || !config.unsplash.accessKey) {
      return res.status(500).json({
        error: 'Unsplash API keys are not configured'
      });
    }

    // Prepare query parameters for Unsplash API
    const params = {
      client_id: config.unsplash.accessKey
    };

    // Add optional parameters if provided
    const { query, orientation, contentFilter, count = 1 } = req.query;
    if (query) params.query = query;
    if (orientation) params.orientation = orientation;
    if (contentFilter) params.content_filter = contentFilter;
    if (count) params.count = Math.min(parseInt(count), 30); // Max 30 per request

    // Call the Unsplash Random Photos API
    const response = await axios.get('https://api.unsplash.com/photos/random', {
      params,
      timeout: 8000,
    });

    res.status(200).json({
      success: true,
      photos: Array.isArray(response.data) ? response.data : [response.data]
    });

  } catch (error) {
    logger.error('Error in Unsplash random photo retrieval:', error);
    
    res.status(500).json({
      error: 'Failed to get random Unsplash photos',
      details: 'Service unavailable'
    });
  }
});

// Get a specific photo by ID
router.get('/photo/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate photo ID
    if (!id) {
      return res.status(400).json({
        error: 'Photo ID is required'
      });
    }

    // Check if Unsplash API keys are configured
    if (!config.unsplash || !config.unsplash.accessKey) {
      return res.status(500).json({
        error: 'Unsplash API keys are not configured'
      });
    }

    // Call the Unsplash Photo Details API
    const response = await axios.get(`https://api.unsplash.com/photos/${id}`, {
      params: { client_id: config.unsplash.accessKey },
      timeout: 8000,
    });

    res.status(200).json({
      success: true,
      photo: response.data
    });

  } catch (error) {
    logger.error('Error in Unsplash photo retrieval:', error);
    
    res.status(500).json({
      error: 'Failed to get Unsplash photo details',
      details: 'Service unavailable'
    });
  }
});

// Get photos from a specific collection
router.get('/collection/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, perPage = 10 } = req.query;

    // Validate collection ID
    if (!id) {
      return res.status(400).json({
        error: 'Collection ID is required'
      });
    }

    // Check if Unsplash API keys are configured
    if (!config.unsplash || !config.unsplash.accessKey) {
      return res.status(500).json({
        error: 'Unsplash API keys are not configured'
      });
    }

    // Call the Unsplash Collection Photos API
    const response = await axios.get(`https://api.unsplash.com/collections/${id}/photos`, {
      params: {
        client_id: config.unsplash.accessKey,
        page: parseInt(page),
        per_page: parseInt(perPage),
      },
      timeout: 8000,
    });

    res.status(200).json({
      success: true,
      photos: response.data,
      currentPage: parseInt(page)
    });

  } catch (error) {
    logger.error('Error in Unsplash collection retrieval:', error);
    
    res.status(500).json({
      error: 'Failed to get Unsplash collection photos',
      details: 'Service unavailable'
    });
  }
});

// Get trending photos
router.get('/trending', async (req, res) => {
  try {
    // Check if Unsplash API keys are configured
    if (!config.unsplash || !config.unsplash.accessKey) {
      return res.status(500).json({
        error: 'Unsplash API keys are not configured'
      });
    }

    // Call the Unsplash Photos API to get curated photos (as a substitute for trending)
    const { page = 1, perPage = 10 } = req.query;

    const response = await axios.get('https://api.unsplash.com/photos/curated', {
      params: {
        client_id: config.unsplash.accessKey,
        page: parseInt(page),
        per_page: parseInt(perPage),
      },
      timeout: 8000,
    });

    res.status(200).json({
      success: true,
      photos: response.data
    });

  } catch (error) {
    logger.error('Error in Unsplash trending photos retrieval:', error);
    
    res.status(500).json({
      error: 'Failed to get trending Unsplash photos',
      details: 'Service unavailable'
    });
  }
});

module.exports = router;