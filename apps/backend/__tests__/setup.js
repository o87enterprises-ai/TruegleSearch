// Jest global setup: environment defaults + quiet console.
//
// This project runs on PostgreSQL (see db/connection.js) — it does NOT use
// MongoDB. No database is booted here: pure unit tests mock what they need, and
// tests that exercise a live database read DATABASE_URL from the environment.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32-chars-xx';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-google-api-key';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-search-engine-id';

// Silence console during tests unless DEBUG is set.
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
