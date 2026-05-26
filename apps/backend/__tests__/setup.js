const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-xx';
process.env.GOOGLE_API_KEY = 'test-google-api-key';
process.env.GOOGLE_SEARCH_ENGINE_ID = 'test-search-engine-id';

let mongoServer;

// Connect to in-memory MongoDB before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

// Clear all collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Disconnect and stop MongoDB after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Silence console during tests unless DEBUG is set
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
