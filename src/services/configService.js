const Settings = require('../models/Settings');
const logger = require('../utils/logger');

/**
 * Configuration Service
 * Centralized service to fetch and manage application settings
 * 
 * PRIORITY SYSTEM:
 * 1. Database credentials always have FIRST PRIORITY
 * 2. Environment variables are used as FALLBACK only when DB values are empty/null
 * 3. This applies to ALL credentials: Cloudinary, Bundle.social, Email, Reddit, RapidAPI, Firebase, etc.
 * 
 * Settings are stored in database and can be updated via admin panel.
 * When settings are updated in DB, they immediately take precedence over .env values.
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
        .select('+cloudinary.apiSecret +mongodb.uri +email.resend.apiKey +email.smtp.pass +apiKeys.falApiKey +apiKeys.bundleSocialApiKey +reddit.clientId +reddit.clientSecret +reddit.password +firebase.serviceAccount +rapidApi.key');

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
        falApiKey: process.env.FAL_API_KEY || '',
        falModel: process.env.FAL_MODEL || 'fal-ai/flux/dev',
        bundleSocialApiKey: process.env.BUNDLE_SOCIAL_API_KEY || '',
        bundleSocialOrgId: process.env.BUNDLE_SOCIAL_ORG_ID || ''
      },
      reddit: {
        clientId: process.env.REDDIT_CLIENT_ID || '',
        clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
        username: process.env.REDDIT_USERNAME || '',
        password: process.env.REDDIT_PASSWORD || '',
        userAgent: process.env.REDDIT_USER_AGENT || 'SoloAI/1.0.0'
      },
      rapidApi: {
        key: process.env.RAPIDAPI_KEY || '',
        enabled: process.env.RAPIDAPI_ENABLED === 'true' || (process.env.RAPIDAPI_KEY ? true : false)
      },
      firebase: {
        serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',
        enabled: process.env.FIREBASE_ENABLED === 'true' || false
      },
      inspiration: {
        cacheTTL: parseInt(process.env.INSPIRATION_CACHE_TTL) || 86400,
        trendsCacheTTL: parseInt(process.env.TRENDS_CACHE_TTL) || 3600
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
   * Database credentials have PRIORITY over environment variables
   */
  async getCloudinaryConfig() {
    const settings = await this.getSettings();
    const dbCloudinary = settings.cloudinary;
    const envCloudinary = this.getFallbackSettings().cloudinary;
    
    // DB credentials take priority for each field
    return {
      cloudName: dbCloudinary?.cloudName || envCloudinary.cloudName,
      apiKey: dbCloudinary?.apiKey || envCloudinary.apiKey,
      apiSecret: dbCloudinary?.apiSecret || envCloudinary.apiSecret
    };
  }

  /**
   * Get Email configuration
   * Database credentials have PRIORITY over environment variables
   */
  async getEmailConfig() {
    const settings = await this.getSettings();
    const dbEmail = settings.email;
    const envEmail = this.getFallbackSettings().email;
    
    if (!dbEmail) {
      return envEmail;
    }
    
    // DB credentials take priority, merge with env fallbacks
    return {
      provider: dbEmail.provider || envEmail.provider,
      resend: {
        apiKey: dbEmail.resend?.apiKey || envEmail.resend.apiKey,
        fromEmail: dbEmail.resend?.fromEmail || envEmail.resend.fromEmail,
        fromName: dbEmail.resend?.fromName || envEmail.resend.fromName
      },
      smtp: {
        host: dbEmail.smtp?.host || envEmail.smtp.host,
        port: dbEmail.smtp?.port || envEmail.smtp.port,
        secure: dbEmail.smtp?.secure !== undefined ? dbEmail.smtp.secure : envEmail.smtp.secure,
        user: dbEmail.smtp?.user || envEmail.smtp.user,
        pass: dbEmail.smtp?.pass || envEmail.smtp.pass,
        fromEmail: dbEmail.smtp?.fromEmail || envEmail.smtp.fromEmail,
        fromName: dbEmail.smtp?.fromName || envEmail.smtp.fromName
      }
    };
  }

  /**
   * Get Bundle.social configuration
   * Database credentials have PRIORITY over environment variables
   */
  async getBundleSocialConfig() {
    const settings = await this.getSettings();
    
    // DB credentials take priority - only fall back to env if DB values are empty/null
    const apiKey = settings.apiKeys?.bundleSocialApiKey || process.env.BUNDLE_SOCIAL_API_KEY || '';
    const orgId = settings.apiKeys?.bundleSocialOrgId || process.env.BUNDLE_SOCIAL_ORG_ID || '';
    
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
   * Database credentials have PRIORITY over environment variables
   */
  async getApiKeys() {
    const settings = await this.getSettings();
    const dbKeys = settings.apiKeys;
    const envKeys = this.getFallbackSettings().apiKeys;
    
    // DB credentials take priority for each key
    return {
      falApiKey: dbKeys?.falApiKey || envKeys.falApiKey,
      falModel: dbKeys?.falModel || envKeys.falModel,
      bundleSocialApiKey: dbKeys?.bundleSocialApiKey || envKeys.bundleSocialApiKey,
      bundleSocialOrgId: dbKeys?.bundleSocialOrgId || envKeys.bundleSocialOrgId
    };
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
   * Get Reddit API configuration
   * Database credentials have PRIORITY over environment variables
   */
  async getRedditConfig() {
    const settings = await this.getSettings();
    const dbReddit = settings.reddit;
    const envReddit = this.getFallbackSettings().reddit;
    
    // DB credentials take priority for each field
    return {
      clientId: dbReddit?.clientId || envReddit.clientId,
      clientSecret: dbReddit?.clientSecret || envReddit.clientSecret,
      username: dbReddit?.username || envReddit.username,
      password: dbReddit?.password || envReddit.password,
      userAgent: dbReddit?.userAgent || envReddit.userAgent
    };
  }

  /**
   * Get Inspiration API settings
   */
  async getInspirationConfig() {
    const settings = await this.getSettings();
    return settings.inspiration || this.getFallbackSettings().inspiration;
  }

  /**
   * Get Firebase configuration
   * Database credentials have PRIORITY over environment variables
   */
  async getFirebaseConfig() {
    const settings = await this.getSettings();
    const dbFirebase = settings.firebase;
    const envFirebase = this.getFallbackSettings().firebase;
    
    // DB credentials take priority
    return {
      serviceAccount: dbFirebase?.serviceAccount || envFirebase.serviceAccount,
      enabled: dbFirebase?.enabled !== undefined ? dbFirebase.enabled : envFirebase.enabled
    };
  }

  /**
   * Get RapidAPI configuration
   * Database credentials have PRIORITY over environment variables
   */
  async getRapidApiConfig() {
    const settings = await this.getSettings();
    const dbRapid = settings.rapidApi;
    const envRapid = this.getFallbackSettings().rapidApi;
    
    // DB credentials take priority
    const apiKey = dbRapid?.key || envRapid.key;
    return {
      key: apiKey,
      enabled: dbRapid?.enabled !== undefined ? dbRapid.enabled : (apiKey ? true : false)
    };
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
