const axios = require('axios');

const bundleSocialConfig = {
  baseURL: process.env.BUNDLE_SOCIAL_BASE_URL || 'https://api.bundle.social/api/v1',
  apiKey: process.env.BUNDLE_SOCIAL_API_KEY,
  organizationId: process.env.BUNDLE_SOCIAL_ORG_ID,
  timeout: 30000, // 30 seconds
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

// Request interceptor
bundleSocialAPI.interceptors.request.use(
  (config) => {
    console.log(`Bundle.social API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
bundleSocialAPI.interceptors.response.use(
  (response) => {
    console.log(`Bundle.social API Response: ${response.status} ${response.statusText}`);
    return response;
  },
  (error) => {
    console.error('Bundle.social API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

module.exports = {
  bundleSocialConfig,
  bundleSocialAPI,
};