#!/usr/bin/env node
/**
 * Authentication System Diagnostic Script
 * Verifies database connection, user schema, and auth flow integrity
 */
require('dotenv').config();
const { pool, query } = require('../db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${COLORS.green}✓ ${msg}${COLORS.reset}`),
  error: (msg) => console.log(`${COLORS.red}✗ ${msg}${COLORS.reset}`),
  warn: (msg) => console.log(`${COLORS.yellow}⚠ ${msg}${COLORS.reset}`),
  info: (msg) => console.log(`${COLORS.cyan}ℹ ${msg}${COLORS.reset}`),
};

async function runDiagnostics() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('          TRUEGLE AUTH SYSTEM DIAGNOSTIC');
  console.log('═══════════════════════════════════════════════════════════\n');

  const results = {
    database: false,
    schema: false,
    passwordHashing: false,
    jwtGeneration: false,
    jwtValidation: false,
    jwtSecret: false,
  };

  // 1. Check database connection
  console.log('1. Database Connection');
  console.log('───────────────────────');
  try {
    const result = await query('SELECT NOW() as time, current_database() as db');
    log.success(`Connected to database: ${result.rows[0].db}`);
    log.success(`Server time: ${result.rows[0].time}`);
    results.database = true;
  } catch (error) {
    log.error(`Database connection failed: ${error.message}`);
    log.info('Check DATABASE_URL environment variable');
  }
  console.log();

  // 2. Check user schema
  console.log('2. User Schema Validation');
  console.log('─────────────────────────');
  try {
    const schemaResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    if (schemaResult.rows.length === 0) {
      log.error('Users table does not exist!');
      log.info('Run migrations: npm run migrate');
    } else {
      log.success(`Users table found with ${schemaResult.rows.length} columns`);

      const requiredColumns = ['id', 'email', 'password_hash', 'username'];
      const existingColumns = schemaResult.rows.map((r) => r.column_name);

      for (const col of requiredColumns) {
        if (existingColumns.includes(col)) {
          log.success(`  Column '${col}' exists`);
        } else {
          log.error(`  Missing required column: '${col}'`);
        }
      }
      results.schema = requiredColumns.every((c) => existingColumns.includes(c));
    }
  } catch (error) {
    log.error(`Schema check failed: ${error.message}`);
  }
  console.log();

  // 3. Check password hashing
  console.log('3. Password Hashing (bcrypt)');
  console.log('────────────────────────────');
  try {
    const testPassword = 'TestPassword123!';
    const startHash = Date.now();
    const hashed = await bcrypt.hash(testPassword, 12);
    const hashDuration = Date.now() - startHash;

    log.success(`Hashing works (took ${hashDuration}ms)`);

    const startCompare = Date.now();
    const isMatch = await bcrypt.compare(testPassword, hashed);
    const compareDuration = Date.now() - startCompare;

    if (isMatch) {
      log.success(`Password comparison works (took ${compareDuration}ms)`);
      results.passwordHashing = true;
    } else {
      log.error('Password comparison failed!');
    }

    // Test wrong password
    const wrongMatch = await bcrypt.compare('WrongPassword', hashed);
    if (!wrongMatch) {
      log.success('Wrong password correctly rejected');
    } else {
      log.error('Security issue: Wrong password was accepted!');
      results.passwordHashing = false;
    }
  } catch (error) {
    log.error(`Hashing test failed: ${error.message}`);
  }
  console.log();

  // 4. Check JWT Secret
  console.log('4. JWT Configuration');
  console.log('────────────────────');
  if (!process.env.JWT_SECRET) {
    log.error('JWT_SECRET is not set!');
    log.info('Add JWT_SECRET to your .env file');
  } else if (process.env.JWT_SECRET.length < 32) {
    log.warn('JWT_SECRET is short (< 32 chars). Consider using a longer secret.');
    results.jwtSecret = true;
  } else {
    log.success('JWT_SECRET is configured');
    results.jwtSecret = true;
  }
  console.log();

  // 5. Check JWT generation
  console.log('5. JWT Token Generation');
  console.log('───────────────────────');
  try {
    const testPayload = {
      userId: 'test-123',
      email: 'test@example.com',
      role: 'user',
    };

    const token = jwt.sign(testPayload, process.env.JWT_SECRET || 'fallback', {
      expiresIn: '24h',
    });

    if (token) {
      log.success('JWT generation works');
      log.info(`Token length: ${token.length} chars`);
      results.jwtGeneration = true;
    }
  } catch (error) {
    log.error(`JWT generation failed: ${error.message}`);
  }
  console.log();

  // 6. Check JWT validation
  console.log('6. JWT Token Validation');
  console.log('───────────────────────');
  try {
    const testPayload = {
      userId: 'test-123',
      email: 'test@example.com',
      role: 'user',
    };

    const token = jwt.sign(testPayload, process.env.JWT_SECRET || 'fallback', {
      expiresIn: '24h',
    });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback');

    if (decoded.userId === testPayload.userId) {
      log.success('JWT validation works');
      log.success(`Decoded userId: ${decoded.userId}`);
      log.success(`Decoded email: ${decoded.email}`);
      results.jwtValidation = true;
    }

    // Test expired token
    const expiredToken = jwt.sign(testPayload, process.env.JWT_SECRET || 'fallback', {
      expiresIn: '-1s',
    });

    try {
      jwt.verify(expiredToken, process.env.JWT_SECRET || 'fallback');
      log.error('Security issue: Expired token was accepted!');
      results.jwtValidation = false;
    } catch (expError) {
      if (expError.name === 'TokenExpiredError') {
        log.success('Expired tokens correctly rejected');
      }
    }
  } catch (error) {
    log.error(`JWT validation failed: ${error.message}`);
  }
  console.log();

  // 7. Test actual user flow (if database is available)
  console.log('7. User Count Check');
  console.log('───────────────────');
  if (results.database && results.schema) {
    try {
      const countResult = await query('SELECT COUNT(*) as count FROM users');
      log.success(`Total users in database: ${countResult.rows[0].count}`);
    } catch (error) {
      log.error(`User count failed: ${error.message}`);
    }
  } else {
    log.warn('Skipped - database or schema not available');
  }
  console.log();

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                     SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  const allPassed = Object.values(results).every((v) => v);

  Object.entries(results).forEach(([key, passed]) => {
    const status = passed ? `${COLORS.green}PASS${COLORS.reset}` : `${COLORS.red}FAIL${COLORS.reset}`;
    console.log(`  ${key.padEnd(20)} ${status}`);
  });

  console.log();
  if (allPassed) {
    log.success('All checks passed! Auth system is operational.');
  } else {
    log.error('Some checks failed. Review the issues above.');
  }
  console.log();

  // Cleanup
  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

runDiagnostics().catch((error) => {
  console.error('Diagnostic script failed:', error);
  process.exit(1);
});
