const Settings = require('../models/Settings');
const logger = require('../utils/logger');

/**
 * Configuration Service
 * Centralized service to fetch and manage application settings
 * Settings are stored in database and can be updated via admin panel
 */
class ConfigService {
  constructor() {
    this.cachedSettings = null;
    this.lastFetch = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get settings from database with caching
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Object>} Settings object
   */
  async getSettings(forceRefresh = false) {
    try {
      // Return cached settings if valid
      const now = Date.now();
      if (!forceRefresh && this.cachedSettings && this.lastFetch && (now - this.lastFetch < this.cacheTimeout)) {
        logger.debug('Returning cached settings');
        return this.cachedSettings;
      }

      // Fetch from database
      logger.debug('Fetching settings from database');
      const settings = await Settings.findById('app_settings')
        .select('+cloudinary.apiSecret +mongodb.uri +email.resend.apiKey +email.smtp.pass +apiKeys.geminiApiKey +apiKeys.bundleSocialApiKey');

      if (!settings) {
        logger.warn('No settings found in database, creating from environment variables');
        const newSettings = await Settings.getSettings();
        this.cachedSettings = newSettings.toObject();
        this.lastFetch = now;
        return this.cachedSettings;
      }

      // Cache the settings
      this.cachedSettings = settings.toObject();
      this.lastFetch = now;

      logger.debug('Settings fetched and cached successfully');
      return this.cachedSettings;
    } catch (error) {
      logger.error('Failed to fetch settings from database:', error.message);
      
      // Fallback to environment variables
      logger.warn('Falling back to environment variables');
      return this.getFallbackSettings();
    }
  }

  /**
   * Invalidate cache (call after settings update)
   */
  invalidateCache() {
    logger.info('Settings cache invalidated');
    this.cachedSettings = null;
    this.lastFetch = null;
  }

  /**
   * Fallback to environment variables if database is unavailable
   */
  getFallbackSettings() {
    return {
      cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || ''
      },
      mongodb: {
        uri: process.env.DATABASE_URI || ''
      },
      email: {
        provider: 'resend', // Default provider
        resend: {
          apiKey: process.env.RESEND_API_KEY || '',
          fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@soloai.com',
          fromName: process.env.RESEND_FROM_NAME || 'Solo AI'
        },
        smtp: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
          fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@soloai.com',
          fromName: process.env.SMTP_FROM_NAME || 'Solo AI'
        }
      },
      videoUpload: {
        maxFileSize: 100,
        allowedFormats: ['mp4', 'avi', 'mov', 'wmv', 'quicktime'],
        uploadPath: './uploads/videos'
      },
      apiKeys: {
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        bundleSocialApiKey: process.env.BUNDLE_SOCIAL_API_KEY || '',
        bundleSocialOrgId: process.env.BUNDLE_SOCIAL_ORG_ID || ''
      },
      urls: {
        productionUrl: process.env.PRODUCTION_URL || '',
        frontendUrl: process.env.FRONTEND_URL || ''
      },
      app: {
        name: 'Solo AI',
        description: 'AI-powered video editing platform',
        supportEmail: 'support@soloai.com',
        maintenanceMode: false,
        allowNewRegistrations: true
      },
      features: {
        videoEditingEnabled: true,
        socialMediaIntegrationEnabled: true,
        aiAssistantEnabled: true,
        adminPanelEnabled: true
      }
    };
  }

  /**
   * Get specific setting value
   * @param {string} path - Dot notation path (e.g., 'email.provider', 'cloudinary.apiKey')
   * @returns {Promise<any>} Setting value
   */
  async get(path) {
    const settings = await this.getSettings();
    const keys = path.split('.');
    let value = settings;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get Cloudinary configuration
   */
  async getCloudinaryConfig() {
    const settings = await this.getSettings();
    return settings.cloudinary || this.getFallbackSettings().cloudinary;
  }

  /**
   * Get Email configuration
   */
  async getEmailConfig() {
    const settings = await this.getSettings();
    return settings.email || this.getFallbackSettings().email;
  }

  /**
   * Get Bundle.social configuration
   */
  async getBundleSocialConfig() {
    const settings = await this.getSettings();
    const apiKey = settings.apiKeys?.bundleSocialApiKey || process.env.BUNDLE_SOCIAL_API_KEY;
    const orgId = settings.apiKeys?.bundleSocialOrgId || process.env.BUNDLE_SOCIAL_ORG_ID;
    
    return {
      apiKey,
      organizationId: orgId,
      baseURL: process.env.BUNDLE_SOCIAL_BASE_URL || 'https://api.bundle.social/api/v1'
    };
  }

  /**
   * Get video upload configuration
   */
  async getVideoUploadConfig() {
    const settings = await this.getSettings();
    return settings.videoUpload || this.getFallbackSettings().videoUpload;
  }

  /**
   * Get API keys
   */
  async getApiKeys() {
    const settings = await this.getSettings();
    return settings.apiKeys || this.getFallbackSettings().apiKeys;
  }

  /**
   * Get application URLs
   */
  async getUrls() {
    const settings = await this.getSettings();
    return settings.urls || this.getFallbackSettings().urls;
  }

  /**
   * Get application settings
   */
  async getAppSettings() {
    const settings = await this.getSettings();
    return settings.app || this.getFallbackSettings().app;
  }

  /**
   * Get feature flags
   */
  async getFeatures() {
    const settings = await this.getSettings();
    return settings.features || this.getFallbackSettings().features;
  }

  /**
   * Check if maintenance mode is enabled
   */
  async isMaintenanceMode() {
    const appSettings = await this.getAppSettings();
    return appSettings.maintenanceMode || false;
  }

  /**
   * Check if new registrations are allowed
   */
  async areNewRegistrationsAllowed() {
    const appSettings = await this.getAppSettings();
    return appSettings.allowNewRegistrations !== false; // Default to true
  }
}

// Export singleton instance
module.exports = new ConfigService();
