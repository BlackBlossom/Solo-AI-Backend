const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for AI endpoints to prevent abuse and stay within free tier limits
 * Perplexity free tier has limited requests, so we set conservative limits
 */
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // 5 requests per minute (conservative for free tier)
  message: {
    status: 'error',
    message: 'Too many AI requests. Please wait a moment and try again.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: false, // Count failed requests too
});

module.exports = aiRateLimiter;
