const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const router = express.Router();
const config = require('../config/env');
const logger = require('../utils/logger');

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Transcribe audio using Deepgram
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    // Check if Deepgram API key is configured
    if (!config.deepgram.apiKey) {
      return res.status(500).json({
        error: 'Deepgram API key is not configured'
      });
    }

    // Check if audio file is provided
    if (!req.file) {
      return res.status(400).json({
        error: 'Audio file is required'
      });
    }

    // Prepare form data for Deepgram API
    const formData = new FormData();
    formData.append('audio', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Call Deepgram API for transcription
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Token ${config.deepgram.apiKey}`
        },
        params: {
          // Common transcription parameters
          punctuate: true,
          utterances: true,
          diarize: true,
          smart_format: true
        }
      }
    );

    res.status(200).json({
      success: true,
      transcription: response.data
    });

  } catch (error) {
    logger.error('Error in audio transcription:', error);
    
    res.status(500).json({
      error: 'Failed to transcribe audio',
      details: 'Service unavailable'
    });
  }
});

// Transcribe audio from URL using Deepgram
router.post('/transcribe-url', async (req, res) => {
  try {
    const { audioUrl, options = {} } = req.body;

    // Validate required parameters
    if (!audioUrl) {
      return res.status(400).json({
        error: 'Audio URL is required'
      });
    }

    // Check if Deepgram API key is configured
    if (!config.deepgram.apiKey) {
      return res.status(500).json({
        error: 'Deepgram API key is not configured'
      });
    }

    // Prepare request body for Deepgram API
    const requestBody = {
      url: audioUrl
    };

    // Call Deepgram API for transcription from URL
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${config.deepgram.apiKey}`
        },
        params: {
          // Common transcription parameters
          punctuate: true,
          utterances: true,
          diarize: true,
          smart_format: true,
          ...options
        }
      }
    );

    res.status(200).json({
      success: true,
      transcription: response.data
    });

  } catch (error) {
    logger.error('Error in audio transcription from URL:', error);
    
    res.status(500).json({
      error: 'Failed to transcribe audio from URL',
      details: 'Service unavailable'
    });
  }
});

// Analyze audio sentiment using Deepgram
router.post('/analyze-sentiment', upload.single('audio'), async (req, res) => {
  try {
    // Check if Deepgram API key is configured
    if (!config.deepgram.apiKey) {
      return res.status(500).json({
        error: 'Deepgram API key is not configured'
      });
    }

    // Check if audio file is provided
    if (!req.file) {
      return res.status(400).json({
        error: 'Audio file is required'
      });
    }

    // Prepare form data for Deepgram API
    const formData = new FormData();
    formData.append('audio', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Call Deepgram API for sentiment analysis
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Token ${config.deepgram.apiKey}`
        },
        params: {
          // Parameters for sentiment analysis
          punctuate: true,
          utterances: true,
          sentiment: true
        }
      }
    );

    res.status(200).json({
      success: true,
      analysis: response.data
    });

  } catch (error) {
    logger.error('Error in audio sentiment analysis:', error);
    
    res.status(500).json({
      error: 'Failed to analyze audio sentiment',
      details: 'Service unavailable'
    });
  }
});

// Get Deepgram API balance/information
router.get('/account', async (req, res) => {
  try {
    // Check if Deepgram API key is configured
    if (!config.deepgram.apiKey) {
      return res.status(500).json({
        error: 'Deepgram API key is not configured'
      });
    }

    // Call Deepgram API for account information
    const response = await axios.get(
      'https://api.deepgram.com/v1/projects',
      {
        headers: {
          'Authorization': `Token ${config.deepgram.apiKey}`
        }
      }
    );

    res.status(200).json({
      success: true,
      accountInfo: response.data
    });

  } catch (error) {
    logger.error('Error getting Deepgram account info:', error);
    
    res.status(500).json({
      error: 'Failed to get Deepgram account information',
      details: 'Service unavailable'
    });
  }
});

module.exports = router;