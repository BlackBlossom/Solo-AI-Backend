const axios = require('axios');
const logger = require('../utils/logger');
const configService = require('../services/configService');

// Configuration object - Database credentials have priority over environment variables
let bundleSocialConfig = {
  baseURL: process.env.BUNDLE_SOCIAL_BASE_URL || 'https://api.bundle.social/api/v1',
  apiKey: null,
  organizationId: null,
  timeout: parseInt(process.env.VIDEO_UPLOAD_TIMEOUT) || 120000,
  maxRetries: parseInt(process.env.VIDEO_UPLOAD_MAX_RETRIES) || 3,
  retryBaseDelay: parseInt(process.env.VIDEO_UPLOAD_RETRY_BASE_DELAY) || 1000,
  retryMaxDelay: parseInt(process.env.VIDEO_UPLOAD_RETRY_MAX_DELAY) || 30000,
};

// Function to update config from database (DB has priority over ENV)
const updateConfigFromDatabase = async () => {
  try {
    const dbConfig = await configService.getBundleSocialConfig();
    
    // Database credentials take priority over environment variables
    bundleSocialConfig.apiKey = dbConfig.apiKey || process.env.BUNDLE_SOCIAL_API_KEY;
    bundleSocialConfig.organizationId = dbConfig.organizationId || process.env.BUNDLE_SOCIAL_ORG_ID;
    
    if (dbConfig.apiKey && dbConfig.organizationId) {
      logger.info('Bundle.social configuration loaded from database (DB credentials have priority)');
    } else if (bundleSocialConfig.apiKey && bundleSocialConfig.organizationId) {
      logger.info('Bundle.social configuration loaded from environment variables (DB credentials not found)');
    } else {
      logger.warn('Bundle.social configuration incomplete - missing API key or Organization ID');
    }
  } catch (error) {
    logger.warn('Failed to fetch Bundle.social config from database, falling back to environment variables:', error.message);
    bundleSocialConfig.apiKey = process.env.BUNDLE_SOCIAL_API_KEY;
    bundleSocialConfig.organizationId = process.env.BUNDLE_SOCIAL_ORG_ID;
  }
};

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

let bundleSocialAPI = null;
let configInitialized = false;

// Initialize configuration and API instance
const initializeBundleSocialAPI = async () => {
  if (configInitialized) {
    return bundleSocialAPI;
  }
  
  await updateConfigFromDatabase();
  bundleSocialAPI = createBundleSocialAPI();
  configInitialized = true;
  
  logger.info(`Bundle.social API initialized with ${bundleSocialConfig.timeout/1000}s timeout for video processing`);
  return bundleSocialAPI;
};

// Function to get API instance (lazy initialization)
const getBundleSocialAPI = async () => {
  if (!bundleSocialAPI) {
    await initializeBundleSocialAPI();
  }
  return bundleSocialAPI;
};

// Function to reconfigure Bundle.social API (call after settings update)
const reconfigureBundleSocialAPI = async () => {
  logger.info('Reconfiguring Bundle.social API with updated settings...');
  await updateConfigFromDatabase();
  bundleSocialAPI = createBundleSocialAPI();
  logger.info('Bundle.social API reconfigured successfully');
};

// Initialize on module load (but don't block)
initializeBundleSocialAPI().catch(err => {
  logger.error('Failed to initialize Bundle.social API on startup:', err.message);
});

module.exports = {
  bundleSocialConfig,
  get bundleSocialAPI() {
    // Return API instance, will be null until initialized
    return bundleSocialAPI;
  },
  getBundleSocialAPI,
  reconfigureBundleSocialAPI,
  updateConfigFromDatabase
};