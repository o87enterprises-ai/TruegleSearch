module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'models/**/*.js',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testTimeout: 30000,
  verbose: true,
};
