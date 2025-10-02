// Application constants
const constants = {
  // JWT
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_SECRET: process.env.JWT_SECRET,
  
  // File upload limits
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  
  // Video processing
  DEFAULT_VIDEO_QUALITY: 720,
  MAX_VIDEO_DURATION: 600, // 10 minutes in seconds
  
  // Social media platforms
  SUPPORTED_PLATFORMS: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'],
  
  // Bundle.social
  BUNDLE_SOCIAL: {
    BASE_URL: process.env.BUNDLE_SOCIAL_BASE_URL,
    API_KEY: process.env.BUNDLE_SOCIAL_API_KEY,
    ORG_ID: process.env.BUNDLE_SOCIAL_ORG_ID,
  },
  
  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
  },
  
  // Password security
  PASSWORD_MIN_LENGTH: 8,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_TIME: 2 * 60 * 60 * 1000, // 2 hours
};

module.exports = constants;