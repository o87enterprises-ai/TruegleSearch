const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  return app;
};

describe('Auth Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('User Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'newuser@example.com',
        password: 'securePassword123',
        name: 'New User',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.user.name).toBe('New User');
      expect(response.body.user.role).toBe('user');

      // Verify token is valid
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.email).toBe('newuser@example.com');

      // Verify user was saved to database
      const savedUser = await User.findOne({ email: 'newuser@example.com' });
      expect(savedUser).toBeDefined();
      expect(savedUser.name).toBe('New User');
    });

    it('should hash password when saving user', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'hashtest@example.com',
        password: 'plainPassword123',
        name: 'Hash Test User',
      });

      // Get user with password field
      const savedUser = await User.findOne({
        email: 'hashtest@example.com',
      }).select('+password');
      expect(savedUser.password).not.toBe('plainPassword123');
      expect(savedUser.password).toMatch(/^\$2[aby]?\$/); // bcrypt hash pattern
    });

    it('should prevent duplicate email registration', async () => {
      // Register first user
      await request(app).post('/api/auth/register').send({
        email: 'duplicate@example.com',
        password: 'password123',
        name: 'First User',
      });

      // Try to register with same email
      const response = await request(app).post('/api/auth/register').send({
        email: 'duplicate@example.com',
        password: 'differentPassword',
        name: 'Second User',
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('User already exists');
    });

    it('should normalize email to lowercase', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'UPPERCASE@EXAMPLE.COM',
        password: 'password123',
        name: 'Uppercase Email User',
      });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('uppercase@example.com');
    });
  });

  describe('User Login Flow', () => {
    beforeEach(async () => {
      // Create a test user before each login test
      await request(app).post('/api/auth/register').send({
        email: 'logintest@example.com',
        password: 'correctPassword123',
        name: 'Login Test User',
      });
    });

    it('should login with correct credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'logintest@example.com',
        password: 'correctPassword123',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('logintest@example.com');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'logintest@example.com',
        password: 'wrongPassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication failed');
    });

    it('should reject login for non-existent user', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'anyPassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication failed');
    });

    it('should update last login timestamp', async () => {
      const beforeLogin = new Date();

      await request(app).post('/api/auth/login').send({
        email: 'logintest@example.com',
        password: 'correctPassword123',
      });

      const user = await User.findOne({ email: 'logintest@example.com' });
      expect(user.lastLogin).toBeDefined();
      expect(new Date(user.lastLogin).getTime()).toBeGreaterThanOrEqual(
        beforeLogin.getTime()
      );
      expect(user.loginCount).toBe(1);
    });

    it('should increment login count on multiple logins', async () => {
      // Login three times
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/auth/login').send({
          email: 'logintest@example.com',
          password: 'correctPassword123',
        });
      }

      const user = await User.findOne({ email: 'logintest@example.com' });
      expect(user.loginCount).toBe(3);
    });
  });

  describe('Token Validation', () => {
    it('should return token with correct expiry', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'tokentest@example.com',
        password: 'password123',
        name: 'Token Test User',
      });

      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);

      // Token should expire in ~24 hours
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(86400); // 24 hours in seconds
    });

    it('should include user role in token', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'roletest@example.com',
        password: 'password123',
        name: 'Role Test User',
      });

      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.role).toBe('user');
    });
  });
});

describe('User Model Tests', () => {
  describe('Password Comparison', () => {
    it('should correctly compare passwords', async () => {
      const user = new User({
        email: 'compare@example.com',
        password: 'testPassword123',
        name: 'Compare Test',
      });
      await user.save();

      const savedUser = await User.findOne({
        email: 'compare@example.com',
      }).select('+password');

      const correctResult = await savedUser.comparePassword('testPassword123');
      expect(correctResult).toBe(true);

      const wrongResult = await savedUser.comparePassword('wrongPassword');
      expect(wrongResult).toBe(false);
    });
  });

  describe('Search Quota', () => {
    it('should have default search quota', async () => {
      const user = new User({
        email: 'quota@example.com',
        password: 'password123',
        name: 'Quota Test',
      });
      await user.save();

      expect(user.searchQuota.dailySearches).toBe(100);
      expect(user.searchQuota.searchesUsed).toBe(0);
    });

    it('should check quota correctly', async () => {
      const user = new User({
        email: 'quotacheck@example.com',
        password: 'password123',
        name: 'Quota Check Test',
      });
      await user.save();

      const hasQuota = user.hasSearchQuota();
      expect(hasQuota).toBe(true);
    });

    it('should increment search usage', async () => {
      const user = new User({
        email: 'increment@example.com',
        password: 'password123',
        name: 'Increment Test',
      });
      await user.save();

      await user.incrementSearchUsage();

      const updatedUser = await User.findOne({
        email: 'increment@example.com',
      });
      expect(updatedUser.searchQuota.searchesUsed).toBe(1);
    });
  });

  describe('Static Methods', () => {
    it('should find user by email', async () => {
      const user = new User({
        email: 'findme@example.com',
        password: 'password123',
        name: 'Find Me',
      });
      await user.save();

      const found = await User.findByEmail('FINDME@EXAMPLE.COM');
      expect(found).toBeDefined();
      expect(found.name).toBe('Find Me');
    });
  });
});
