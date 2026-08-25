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
    // THE WIPE IS PUBLIC ON PURPOSE, and this is the test that used to assert
    // the opposite. Truegle works with no account, so the overwhelming
    // majority of the people who press "wipe all data on this device" are
    // signed out — and requiring a login first inverts the whole point of the
    // button. Worse, the old client SKIPPED the server call when it had no
    // token and still showed the success screen, so a signed-out user was told
    // their ephemeral logs were gone when nothing had been asked to delete
    // them. See the long note on the route for why opening this up is safe.
    it('wipes for a signed-out caller instead of demanding a login', async () => {
      query.mockResolvedValueOnce({ rowCount: 2 }); // rate_limit_cache, by IP

      const response = await request(app).post('/api/session/wipe');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.authenticated).toBe(false);
    });

    it('still wipes the IP-keyed rows when there is no session token', async () => {
      query.mockResolvedValueOnce({ rowCount: 3 });

      const response = await request(app).post('/api/session/wipe');

      // Exactly one DELETE: the session-token-keyed legs have no key to look
      // under, so they are skipped rather than run against NULL.
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][0]).toMatch(/rate_limit_cache/);
      expect(response.body.wiped.rateLimitCount).toBe(3);
    });

    it('reports the session-keyed legs as skipped, never as wiped', async () => {
      query.mockResolvedValueOnce({ rowCount: 0 });

      const response = await request(app).post('/api/session/wipe');

      // The honesty requirement: "skipped because there was no key" must not
      // be reported as "wiped". Claiming a wipe that never ran is the bug.
      expect(response.body.wiped.ephemeralLogs).toBe('skipped-no-session');
      expect(response.body.wiped.sessionCache).toBe('skipped-no-session');
      expect(response.body.wiped.rateLimitData).toBe(true);
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
      // A token still gets the full three-leg wipe — opening the route up to
      // signed-out callers must not have quietly cost signed-in ones anything.
      expect(response.body.authenticated).toBe(true);
      expect(response.body.wiped.ephemeralLogs).toBe(true);
      expect(response.body.wiped.sessionCache).toBe(true);
      expect(query).toHaveBeenCalledTimes(3);
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
