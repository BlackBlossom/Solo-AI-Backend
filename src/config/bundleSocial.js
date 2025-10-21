const axios = require('axios');
const logger = require('../utils/logger');
const configService = require('../services/configService');

// Initial configuration from environment variables
let bundleSocialConfig = {
  baseURL: process.env.BUNDLE_SOCIAL_BASE_URL || 'https://api.bundle.social/api/v1',
  apiKey: process.env.BUNDLE_SOCIAL_API_KEY,
  organizationId: process.env.BUNDLE_SOCIAL_ORG_ID,
  timeout: parseInt(process.env.VIDEO_UPLOAD_TIMEOUT) || 120000,
  maxRetries: parseInt(process.env.VIDEO_UPLOAD_MAX_RETRIES) || 3,
  retryBaseDelay: parseInt(process.env.VIDEO_UPLOAD_RETRY_BASE_DELAY) || 1000,
  retryMaxDelay: parseInt(process.env.VIDEO_UPLOAD_RETRY_MAX_DELAY) || 30000,
};

// Function to update config from database
const updateConfigFromDatabase = async () => {
  try {
    const dbConfig = await configService.getBundleSocialConfig();
    if (dbConfig.apiKey && dbConfig.organizationId) {
      bundleSocialConfig.apiKey = dbConfig.apiKey;
      bundleSocialConfig.organizationId = dbConfig.organizationId;
      logger.info('Bundle.social configuration updated from database');
    }
  } catch (error) {
    logger.warn('Failed to update Bundle.social config from database, using environment variables:', error.message);
  }
};

// Update config on module load
updateConfigFromDatabase();

// Create axios instance for Bundle.social API
const createBundleSocialAPI = () => {
  return axios.create({
    baseURL: bundleSocialConfig.baseURL,
    timeout: bundleSocialConfig.timeout,
    headers: {
      'x-api-key': bundleSocialConfig.apiKey,
      'Content-Type': 'application/json',
    },
  });
};

let bundleSocialAPI = createBundleSocialAPI();

// Function to reconfigure Bundle.social API (call after settings update)
const reconfigureBundleSocialAPI = async () => {
  logger.info('Reconfiguring Bundle.social API with updated settings...');
  await updateConfigFromDatabase();
  bundleSocialAPI = createBundleSocialAPI();
  logger.info('Bundle.social API reconfigured successfully');
};

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
  reconfigureBundleSocialAPI,
  updateConfigFromDatabase
};