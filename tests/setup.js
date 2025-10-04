// Test setup file
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';
process.env.DATABASE_URI = process.env.TEST_DATABASE_URI || 'mongodb://localhost:27017/video-editing-test';

// Suppress console logs during tests (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Set longer timeout for database operations
jest.setTimeout(30000);

// Mock external services by default
jest.mock('../src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPostPublishedNotification: jest.fn().mockResolvedValue({ success: true })
}));

// Global test cleanup
afterAll(async () => {
  // Close any open database connections
  const mongoose = require('mongoose');
  await mongoose.connection.close();
});