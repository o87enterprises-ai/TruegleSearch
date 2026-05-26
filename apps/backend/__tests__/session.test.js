/**
 * Session Wipe Route Tests
 * Tests for the Nuclear Option feature
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock the database
jest.mock('../db/connection', () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));

const { query } = require('../db/connection');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Add mock privacy middleware
  app.use((req, res, next) => {
    req.anonymizedIP = '192.168.1.0';
    req.ephemeralSession = 'test-session';
    next();
  });

  app.use('/api/session', require('../routes/session'));
  return app;
};

describe('Session Routes', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/session/wipe', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app).post('/api/session/wipe');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should wipe session data with valid token', async () => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Mock database queries to simulate successful wipe
      query
        .mockResolvedValueOnce({ rowCount: 5 }) // ephemeral_logs
        .mockResolvedValueOnce({ rowCount: 2 }) // rate_limit_cache
        .mockResolvedValueOnce({ rowCount: 1 }); // session_cache

      const response = await request(app)
        .post('/api/session/wipe')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Session data wiped successfully');
      expect(response.body.wiped).toBeDefined();
    });

    it('should handle missing tables gracefully', async () => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Mock database queries to throw "table not found" errors
      const tableNotFoundError = new Error('relation does not exist');
      tableNotFoundError.code = '42P01';

      query
        .mockRejectedValueOnce(tableNotFoundError)
        .mockRejectedValueOnce(tableNotFoundError)
        .mockRejectedValueOnce(tableNotFoundError);

      const response = await request(app)
        .post('/api/session/wipe')
        .set('Authorization', `Bearer ${token}`);

      // Should still succeed - tables just don't exist yet
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/session/status', () => {
    it('should return session status for authenticated user', async () => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/session/status')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.sessionActive).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/session/status');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/session/privacy-info', () => {
    it('should return privacy information', async () => {
      const response = await request(app).get('/api/session/privacy-info');

      expect(response.status).toBe(200);
      expect(response.body.dataStored).toBeDefined();
      expect(response.body.dataNotStored).toBeDefined();
      expect(response.body.wipeCapability).toBeDefined();
      expect(response.body.wipeCapability.endpoint).toBe('/api/session/wipe');
    });
  });
});
