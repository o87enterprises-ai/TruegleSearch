// PostgreSQL User Model for Truegle Backend
const { query } = require('../db/connection');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const jwt = require('jsonwebtoken');

class User {
  constructor(userData = {}) {
    this.id = userData.id || null;
    this.email = userData.email || '';
    this.password = userData.password || '';
    this.name = userData.name || '';
    this.role = userData.role || 'user';
    this.isVerified = userData.isVerified || false;
    this.googleId = userData.googleId || null;
    this.isActive = userData.isActive !== undefined ? userData.isActive : true;
    this.lastLogin = userData.lastLogin || null;
    this.loginCount = userData.loginCount || 0;
    this.searchQuota = userData.searchQuota || {
      dailySearches: 100,
      searchesUsed: 0,
      resetAt: new Date(),
    };
    this.preferences = userData.preferences || {
      defaultSearchCategory: 'web',
      safeSearch: true,
      resultsPerPage: 10,
      biasDetection: true,
    };
    this.createdAt = userData.createdAt || new Date();
    this.updatedAt = userData.updatedAt || new Date();
  }

  // Save user to database
  async save() {
    if (this.id) {
      // Update existing user
      const result = await query(
        `UPDATE users SET email = $1, password_hash = $2, username = $3,
         last_login = $4, google_id = $5, updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [
          this.email,
          this.password,
          this.name,
          this.lastLogin,
          this.googleId || null,
          this.id
        ]
      );
      const row = result.rows[0];
      // Keep the instance in sync with the persisted row so callers that don't
      // reassign the return value still see up-to-date fields.
      this.id = row.id;
      return this._mapRowToUser(row);
    } else {
      // Create new user
      const result = await query(
        `INSERT INTO users (email, password_hash, username, google_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [
          this.email,
          this.password,
          this.name,
          this.googleId || null,
        ]
      );
      const row = result.rows[0];
      // Critical: assign the DB-generated id back onto the instance. The Google
      // OAuth flow does `await user.save()` and then reads `user.id` (for token
      // init + balance lookup) without reassigning the return value — without
      // this, new OAuth users had a null id, getBalance() threw "User not found",
      // and the flow redirected to /auth/login?error=oauth_failed.
      this.id = row.id;
      return this._mapRowToUser(row);
    }
  }

  // Map database row to user object
  _mapRowToUser(row) {
    return {
      id: row.id,
      email: row.email,
      name: row.username,
      password: row.password_hash,
      role: row.subscription_tier || 'user',
      isVerified: true,
      googleId: row.google_id || null,
      lastLogin: row.last_login,
      createdAt: row.created_at
    };
  }

  // Find user by ID
  static async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;

    return User._createFromRow(result.rows[0]);
  }

  // Find user by email
  static async findOne(queryObj) {
    let whereClause = '';
    const params = [];

    if (queryObj.email) {
      whereClause = 'WHERE email = $1';
      params.push(queryObj.email.toLowerCase().trim());
    } else if (queryObj.id) {
      whereClause = 'WHERE id = $1';
      params.push(queryObj.id);
    } else if (queryObj.googleId) {
      whereClause = 'WHERE google_id = $1';
      params.push(queryObj.googleId);
    }

    const result = await query(`SELECT * FROM users ${whereClause}`, params);
    if (result.rows.length === 0) return null;

    return User._createFromRow(result.rows[0]);
  }

  // Create User instance from database row
  static _createFromRow(row) {
    const user = new User({
      id: row.id,
      email: row.email,
      password: row.password_hash,
      name: row.username,
      role: row.subscription_tier || 'user',
      isVerified: true,
      isActive: true,
      googleId: row.google_id || null,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
    return user;
  }

  // Find all users with optional query
  static async find(queryObj = {}) {
    let whereClause = '';
    const params = [];
    
    if (queryObj.email) {
      whereClause = 'WHERE email = $1';
      params.push(queryObj.email.toLowerCase().trim());
    }

    const result = await query(`SELECT * FROM users ${whereClause}`, params);
    return result.rows.map(row => new User(row));
  }

  // Compare password
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Update last login
  async updateLastLogin() {
    this.lastLogin = new Date();
    await query(
      'UPDATE users SET last_login = $1, updated_at = NOW() WHERE id = $2',
      [this.lastLogin, this.id]
    );
  }

  // Check search quota
  async hasSearchQuota() {
    const now = new Date();
    const resetAt = new Date(this.searchQuota.resetAt);

    // Reset quota if it's a new day
    if (now.toDateString() !== resetAt.toDateString()) {
      this.searchQuota.searchesUsed = 0;
      this.searchQuota.resetAt = now;
      
      await query(
        'UPDATE users SET search_quota = $1 WHERE id = $2',
        [JSON.stringify(this.searchQuota), this.id]
      );
      return true;
    }

    return this.searchQuota.searchesUsed < this.searchQuota.dailySearches;
  }

  // Increment search usage
  async incrementSearchUsage() {
    this.searchQuota.searchesUsed += 1;
    await query(
      'UPDATE users SET search_quota = $1 WHERE id = $2',
      [JSON.stringify(this.searchQuota), this.id]
    );
  }

  // Get user statistics
  static async getUserStats() {
    const result = await query(`
      SELECT 
        role as _id,
        COUNT(*) as count,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as activeUsers,
        SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END) as verifiedUsers
      FROM users
      GROUP BY role
    `);
    return result.rows;
  }

  // Find user by email (static method)
  static async findByEmail(email) {
    return await this.findOne({ email: email.toLowerCase().trim() });
  }

  // Create users table if it doesn't exist
  static async createTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        is_verified BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        login_count INTEGER DEFAULT 0,
        search_quota JSONB DEFAULT '{"dailySearches": 100, "searchesUsed": 0, "resetAt": null}',
        preferences JSONB DEFAULT '{"defaultSearchCategory": "web", "safeSearch": true, "resultsPerPage": 10, "biasDetection": true}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add google_id column if it doesn't exist (safe migration)
    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE
    `).catch(() => {});
  }
}

module.exports = User;