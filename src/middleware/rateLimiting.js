const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response');

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 429, 'Too many requests from this IP, please try again later.');
  }
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 429, 'Too many authentication attempts, please try again later.');
  }
});

// Upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    status: 'error',
    message: 'Upload limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 429, 'Upload limit exceeded. Please try again later.');
  }
});

// API key based rate limiting (for Bundle.social integration)
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per API key
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  },
  message: {
    status: 'error',
    message: 'API rate limit exceeded.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 429, 'API rate limit exceeded.');
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  apiKeyLimiter
};