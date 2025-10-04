const axios = require('axios');
const logger = require('../utils/logger');

const bundleSocialConfig = {
  baseURL: process.env.BUNDLE_SOCIAL_BASE_URL || 'https://api.bundle.social/api/v1',
  apiKey: process.env.BUNDLE_SOCIAL_API_KEY,
  organizationId: process.env.BUNDLE_SOCIAL_ORG_ID,
  timeout: parseInt(process.env.VIDEO_UPLOAD_TIMEOUT) || 120000, // 2 minutes for video processing, configurable
  maxRetries: parseInt(process.env.VIDEO_UPLOAD_MAX_RETRIES) || 3,
  retryBaseDelay: parseInt(process.env.VIDEO_UPLOAD_RETRY_BASE_DELAY) || 1000,
  retryMaxDelay: parseInt(process.env.VIDEO_UPLOAD_RETRY_MAX_DELAY) || 30000,
};

// Create axios instance for Bundle.social API
const bundleSocialAPI = axios.create({
  baseURL: bundleSocialConfig.baseURL,
  timeout: bundleSocialConfig.timeout,
  headers: {
    'x-api-key': bundleSocialConfig.apiKey,
    'Content-Type': 'application/json',
  },
});

logger.info(`Bundle.social API configured with ${bundleSocialConfig.timeout/1000}s timeout for video processing`);

// Request interceptor
bundleSocialAPI.interceptors.request.use(
  (config) => {
    logger.debug(`Bundle.social API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
bundleSocialAPI.interceptors.response.use(
  (response) => {
    logger.debug(`Bundle.social API Response: ${response.status} ${response.statusText}`);
    return response;
  },
  (error) => {
    logger.error('Bundle.social API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

module.exports = {
  bundleSocialConfig,
  bundleSocialAPI,
};