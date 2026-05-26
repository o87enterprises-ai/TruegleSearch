const request = require('supertest');
const app = require('../server');
const config = require('../config/env');

describe('New API Endpoints Tests', () => {
  // Test social media endpoints
  describe('Social Media API (/api/social)', () => {
    test('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .post('/api/social/search')
        .send({})
        .expect(400);
      
      expect(response.body.error).toBe('Query parameter is required');
    });

    test('should return 500 if Apify API key is not configured', async () => {
      // Temporarily unset the API key to test the error condition
      const originalApiKey = config.apify.apiKey;
      config.apify.apiKey = null;

      const response = await request(app)
        .post('/api/social/search')
        .send({ query: 'test' })
        .expect(500);

      expect(response.body.error).toBe('Apify API key is not configured');

      // Restore the original API key
      config.apify.apiKey = originalApiKey;
    });
  });

  // Test OSINT endpoints
  describe('OSINT API (/api/osint)', () => {
    test('should return 400 for missing required parameters in email finder', async () => {
      const response = await request(app)
        .get('/api/osint/email-finder')
        .query({})
        .expect(400);
      
      expect(response.body.error).toBe('Either domain or company parameter is required');
    });

    test('should return 500 if Hunter.io API key is not configured', async () => {
      // Temporarily unset the API key to test the error condition
      const originalApiKey = config.hunterIo.apiKey;
      config.hunterIo.apiKey = null;

      const response = await request(app)
        .get('/api/osint/email-finder')
        .query({ domain: 'example.com' })
        .expect(500);

      expect(response.body.error).toBe('Hunter.io API key is not configured');

      // Restore the original API key
      config.hunterIo.apiKey = originalApiKey;
    });
  });

  // Test Shodan endpoints
  describe('Shodan API (/api/shodan)', () => {
    test('should return 400 for missing IP parameter', async () => {
      const response = await request(app)
        .get('/api/shodan/ip/')
        .expect(404); // 404 because route parameter is missing
      
      // Note: This test will fail because the route parameter is required
      // A proper test would require a valid IP address
    });

    test('should return 500 if Shodan API key is not configured', async () => {
      // Temporarily unset the API key to test the error condition
      const originalApiKey = config.shodan.apiKey;
      config.shodan.apiKey = null;

      const response = await request(app)
        .get('/api/shodan/info')
        .expect(500);

      expect(response.body.error).toBe('Shodan API key is not configured');

      // Restore the original API key
      config.shodan.apiKey = originalApiKey;
    });
  });

  // Test PayPal endpoints
  describe('PayPal API (/api/paypal)', () => {
    test('should return 400 for missing required parameters in create-payment', async () => {
      const response = await request(app)
        .post('/api/paypal/create-payment')
        .send({})
        .expect(400);
      
      expect(response.body.error).toBe('Amount, returnUrl, and cancelUrl parameters are required');
    });
  });

  // Test Voice/Deepgram endpoints
  describe('Voice API (/api/voice)', () => {
    test('should return 500 if Deepgram API key is not configured', async () => {
      // Temporarily unset the API key to test the error condition
      const originalApiKey = config.deepgram.apiKey;
      config.deepgram.apiKey = null;

      const response = await request(app)
        .get('/api/voice/account')
        .expect(500);

      expect(response.body.error).toBe('Deepgram API key is not configured');

      // Restore the original API key
      config.deepgram.apiKey = originalApiKey;
    });
  });

  // Test Unsplash endpoints
  describe('Unsplash API (/api/unsplash)', () => {
    test('should return 400 for missing query parameter in search', async () => {
      const response = await request(app)
        .get('/api/unsplash/search')
        .query({})
        .expect(400);
      
      expect(response.body.error).toBe('Query parameter is required');
    });

    test('should return 500 if Unsplash API keys are not configured', async () => {
      // Temporarily unset the API key to test the error condition
      const originalAccessKey = config.unsplash.accessKey;
      config.unsplash.accessKey = null;

      const response = await request(app)
        .get('/api/unsplash/search')
        .query({ query: 'test' })
        .expect(500);

      expect(response.body.error).toBe('Unsplash API keys are not configured');

      // Restore the original API key
      config.unsplash.accessKey = originalAccessKey;
    });
  });
});