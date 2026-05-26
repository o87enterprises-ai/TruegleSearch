const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const config = require('../config/env');
const User = require('../models/User');
const TokenService = require('../services/TokenService');
const logger = require('../utils/logger');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters'),
    body('name').trim().isLength({ min: 2 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        email: email.toLowerCase().trim(),
      });
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'A user with this email already exists',
        });
      }

      // Hash password before saving
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create new user
      const newUser = new User({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        role: 'user',
        isVerified: false,
      });

      const savedUser = await newUser.save();

      // Initialize tokens for new user
      await TokenService.initializeNewUser(savedUser.id);
      const tokenBalance = await TokenService.getBalance(savedUser.id);

      // Generate JWT token
      const token = jwt.sign(
        { userId: savedUser.id, email: savedUser.email, role: savedUser.role },
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: savedUser.id,
          email: savedUser.email,
          name: savedUser.name,
          role: savedUser.role,
          tokenBalance: tokenBalance.balance,
          isPremium: tokenBalance.isPremium,
        },
        token,
        expiresIn: 86400, // 24 hours in seconds
      });
    } catch (error) {
      logger.logError(error, req, { action: 'registration' });
      res.status(500).json({
        error: 'Registration failed',
        message: 'Unable to create user account',
      });
    }
  }
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').exists()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({
        email: email.toLowerCase().trim(),
      });
      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password',
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password',
        });
      }

      // Update last login
      await user.updateLastLogin();

      // Get token balance
      const tokenBalance = await TokenService.getBalance(user.id);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
          tokenBalance: tokenBalance.balance,
          isPremium: tokenBalance.isPremium,
        },
        token,
        expiresIn: 86400, // 24 hours in seconds
      });
    } catch (error) {
      logger.logError(error, req, { action: 'login' });
      res.status(500).json({
        error: 'Login failed',
        message: 'Unable to authenticate user',
      });
    }
  }
);

/**
 * @route   GET /api/auth/validate
 * @desc    Validate JWT token and return user
 * @access  Private
 */
router.get('/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Get token balance
    const tokenBalance = await TokenService.getBalance(user.id);

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        tokenBalance: tokenBalance.balance,
        isPremium: tokenBalance.isPremium,
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
    logger.logError(error, req, { action: 'validate' });
    res.status(500).json({
      error: 'Validation failed',
      message: 'Unable to validate token',
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate token on client)
 * @access  Private
 */
router.post('/logout', (req, res) => {
  // JWT tokens are stateless - logout is handled client-side
  // This endpoint exists for API consistency
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

module.exports = router;
