// PostgreSQL Database Utility for Truegle Backend
// Provides the same interface as the original MongoDB implementation
const { query: pgQuery } = require('../db/connection');

class Database {
  constructor() {
    this.isConnected = false;
    this.connection = null;
  }

  async connect() {
    if (this.isConnected) {
      return this.connection;
    }

    try {
      // Test connection
      await pgQuery('SELECT NOW() as current_time');
      console.log('✅ PostgreSQL connected successfully');

      // Ensure users table exists
      const User = require('../models/User');
      await User.createTable();
      console.log('✅ Users table verified/created');

      this.isConnected = true;
      return this.connection;
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error.message);
      throw error;
    }
  }

  async disconnect() {
    // The pool will handle disconnection via process handlers
    this.isConnected = false;
    console.log('✅ PostgreSQL disconnected');
  }

  getConnection() {
    return this.connection;
  }

  getStatus() {
    // Return a status object similar to MongoDB
    return {
      connected: this.isConnected,
      readyState: this.isConnected ? 1 : 0, // 1 for connected, 0 for disconnected
      host: process.env.DATABASE_URL ? 'PostgreSQL' : 'not connected',
      name: process.env.DATABASE_URL ? 'truegle_db' : 'not connected',
    };
  }

  // Health check method
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', message: 'Database not connected' };
      }

      // Test query to verify database health
      const result = await pgQuery('SELECT NOW() as current_time');

      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        timestamp: result.rows[0].current_time,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database health check failed: ' + error.message,
      };
    }
  }
}

// Create singleton instance
const database = new Database();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Closing database connection...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Closing database connection...');
  await database.disconnect();
  process.exit(0);
});

module.exports = database;