const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock the User model
jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  prototype: {
    save: jest.fn(),
    updateLastLogin: jest.fn(),
  },
}));

// Mock the TokenService
jest.mock('../services/TokenService', () => ({
  getBalance: jest.fn().mockResolvedValue({ balance: 100, tier: 'free' }),
  initializeNewUser: jest.fn().mockResolvedValue(true),
}));

// Mock EmailService so /request-code never tries a real Resend call
jest.mock('../services/EmailService', () => ({
  sendLoginCode: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock the database connection
const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('../db/connection', () => ({
  query: (...args) => mockQuery(...args),
}));

const User = require('../models/User');
const EmailService = require('../services/EmailService');

// Create a minimal express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  return app;
};

describe('Auth Routes', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset().mockResolvedValue({ rows: [] });
  });

  describe('POST /api/auth/request-code', () => {
    it('should return 400 for invalid email', async () => {
      const response = await request(app).post('/api/auth/request-code').send({
        email: 'invalid-email',
      });

      expect(response.status).toBe(400);
    });

    it('should return 429 if a code was just sent', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // recent login_codes row

      const response = await request(app).post('/api/auth/request-code').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(429);
    });

    it('should create a free account and email a code for a new address', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // no recent code
        .mockResolvedValueOnce({ rows: [] }) // no existing user
        .mockResolvedValueOnce({ rows: [{ id: 42 }] }) // insert user
        .mockResolvedValueOnce({ rows: [] }); // insert login_codes

      const response = await request(app).post('/api/auth/request-code').send({
        email: 'newperson@example.com',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(EmailService.sendLoginCode).toHaveBeenCalledWith(
        'newperson@example.com',
        expect.any(String)
      );
    });
  });

  describe('POST /api/auth/verify-access-code', () => {
    it('should return 400 when code or contact is missing', async () => {
      const response = await request(app).post('/api/auth/verify-access-code').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
    });

    it('should return 401 for an account that does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no user found

      const response = await request(app).post('/api/auth/verify-access-code').send({
        email: 'nonexistent@example.com',
        code: '123456',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/no active account/i);
    });

    it('should return 401 for an invalid or expired code', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com', username: 'test', role: 'user' }] }) // user lookup
        .mockResolvedValueOnce({ rows: [] }) // no premium codes
        .mockResolvedValueOnce({ rows: [] }); // no login codes

      const response = await request(app).post('/api/auth/verify-access-code').send({
        email: 'test@example.com',
        code: '000000',
      });

      expect(response.status).toBe(401);
    });
  });
});

describe('Auth Middleware', () => {
  const {
    authenticate,
    optionalAuth,
    requireAdmin,
  } = require('../middleware/auth');

  describe('authenticate', () => {
    it('should return 401 without authorization header', () => {
      const req = { headers: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Authentication required' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 with invalid token', () => {
      const req = {
        headers: { authorization: 'Bearer invalid-token' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with valid token', () => {
      const token = jwt.sign(
        { userId: 'test-id', email: 'test@example.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe('test@example.com');
    });
  });

  describe('optionalAuth', () => {
    it('should set guest user without token', () => {
      const req = { headers: {} };
      const res = {};
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.isAuthenticated).toBe(false);
      expect(req.user.role).toBe('guest');
    });

    it('should set authenticated user with valid token', () => {
      const token = jwt.sign(
        { userId: 'test-id', email: 'test@example.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      };
      const res = {};
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.isAuthenticated).toBe(true);
      expect(req.user.email).toBe('test@example.com');
    });
  });

  describe('requireAdmin', () => {
    it('should return 403 for non-admin user', () => {
      const req = { user: { role: 'user' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next for admin user', () => {
      const req = { user: { role: 'admin' } };
      const res = {};
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
