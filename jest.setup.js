/**
 * jest.setup.js
 *
 * Setup file for Jest tests.
 */

// Set test environment variables
process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test_db';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging test failures
  error: console.error,
};
