const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Singleton pattern - only one settings document
  _id: {
    type: String,
    default: 'app_settings'
  },

  // Cloudinary Settings
  cloudinary: {
    cloudName: {
      type: String,
      default: process.env.CLOUDINARY_CLOUD_NAME || ''
    },
    apiKey: {
      type: String,
      default: process.env.CLOUDINARY_API_KEY || ''
    },
    apiSecret: {
      type: String,
      select: false, // Don't return by default for security
      default: process.env.CLOUDINARY_API_SECRET || ''
    }
  },

  // MongoDB Settings
  mongodb: {
    uri: {
      type: String,
      select: false, // Don't return by default for security
      default: process.env.DATABASE_URI || ''
    }
  },

  // Email Settings
  email: {
    // Email Service Provider: 'resend' or 'smtp'
    provider: {
      type: String,
      enum: ['resend', 'smtp'],
      default: 'resend'
    },
    
    // Resend Configuration
    resend: {
      apiKey: {
        type: String,
        select: false, // Don't return by default for security
        default: process.env.RESEND_API_KEY || ''
      },
      fromEmail: {
        type: String,
        default: process.env.RESEND_FROM_EMAIL || 'noreply@soloai.com'
      },
      fromName: {
        type: String,
        default: process.env.RESEND_FROM_NAME || 'Solo AI'
      }
    },
    
    // SMTP Configuration (Gmail or other SMTP servers)
    smtp: {
      host: {
        type: String,
        default: process.env.SMTP_HOST || 'smtp.gmail.com'
      },
      port: {
        type: Number,
        default: process.env.SMTP_PORT || 587
      },
      secure: {
        type: Boolean,
        default: process.env.SMTP_SECURE === 'true' || false
      },
      user: {
        type: String,
        default: process.env.SMTP_USER || ''
      },
      pass: {
        type: String,
        select: false, // Don't return by default for security
        default: process.env.SMTP_PASS || ''
      },
      fromEmail: {
        type: String,
        default: process.env.SMTP_FROM_EMAIL || 'noreply@soloai.com'
      },
      fromName: {
        type: String,
        default: process.env.SMTP_FROM_NAME || 'Solo AI'
      }
    }
  },

  // Firebase Cloud Messaging Settings
  firebase: {
    serviceAccount: {
      type: String, // JSON string of Firebase service account
      select: false, // Don't return by default for security
      default: process.env.FIREBASE_SERVICE_ACCOUNT || ''
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },

  // Video Upload Settings
  videoUpload: {
    maxFileSize: {
      type: Number, // in MB
      default: 100,
      min: 10,
      max: 500
    },
    allowedFormats: {
      type: [String],
      default: ['mp4', 'avi', 'mov', 'wmv', 'quicktime']
    },
    uploadPath: {
      type: String,
      default: './uploads/videos'
    }
  },

  // API Keys
  apiKeys: {
    falApiKey: {
      type: String,
      select: false, // Don't return by default for security
      default: process.env.FAL_API_KEY || ''
    },
    falModel: {
      type: String,
      default: process.env.FAL_MODEL || 'fal-ai/flux/dev'
    },
    bundleSocialApiKey: {
      type: String,
      select: false, // Don't return by default for security
      default: process.env.BUNDLE_SOCIAL_API_KEY || ''
    },
    bundleSocialOrgId: {
      type: String,
      default: process.env.BUNDLE_SOCIAL_ORG_ID || ''
    }
  },

  // Reddit API Configuration
  reddit: {
    clientId: {
      type: String,
      select: false, // Don't return by default for security
      default: process.env.REDDIT_CLIENT_ID || ''
    },
    clientSecret: {
      type: String,
      select: false, // Don't return by default for security
      default: process.env.REDDIT_CLIENT_SECRET || ''
    },
    username: {
      type: String,
      default: process.env.REDDIT_USERNAME || ''
    },
    password: {
      type: String,
      select: false, // Don't return by default for security
      default: process.env.REDDIT_PASSWORD || ''
    },
    userAgent: {
      type: String,
      default: process.env.REDDIT_USER_AGENT || 'SoloAI/1.0.0'
    }
  },

  // RapidAPI Configuration (for Google Trends)
  rapidApi: {
    key: {
      type: String,
      select: false, // Don't return by default for security
      default: process.env.RAPIDAPI_KEY || ''
    },
    enabled: {
      type: Boolean,
      default: process.env.RAPIDAPI_ENABLED === 'true' || (process.env.RAPIDAPI_KEY ? true : false)
    }
  },

  // Inspiration API Settings
  inspiration: {
    cacheTTL: {
      type: Number, // in seconds
      default: parseInt(process.env.INSPIRATION_CACHE_TTL) || 86400 // 24 hours
    },
    trendsCacheTTL: {
      type: Number, // in seconds (shorter cache for trending data)
      default: parseInt(process.env.TRENDS_CACHE_TTL) || 3600 // 1 hour
    }
  },

  // URL Settings
  urls: {
    productionUrl: {
      type: String,
      default: process.env.PRODUCTION_URL || 'https://api.soloai.com'
    },
    frontendUrl: {
      type: String,
      default: process.env.FRONTEND_URL || 'https://app.soloai.com'
    }
  },

  // Application Settings (non-sensitive)
  app: {
    name: {
      type: String,
      default: 'Solo AI'
    },
    description: {
      type: String,
      default: 'AI-powered video editing platform'
    },
    supportEmail: {
      type: String,
      default: 'support@soloai.app',
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format for support email'
      }
    },
    reportProblemEmail: {
      type: String,
      default: 'support@soloai.app',
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format for report problem email'
      }
    },
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    allowNewRegistrations: {
      type: Boolean,
      default: true
    }
  },

  // Feature Flags
  features: {
    videoEditingEnabled: {
      type: Boolean,
      default: true
    },
    socialMediaIntegrationEnabled: {
      type: Boolean,
      default: true
    },
    aiAssistantEnabled: {
      type: Boolean,
      default: true
    },
    adminPanelEnabled: {
      type: Boolean,
      default: true
    }
  },

  // Metadata
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  lastUpdatedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Method to get settings without sensitive data
settingsSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  
  // Remove sensitive fields
  if (obj.cloudinary) {
    delete obj.cloudinary.apiSecret;
  }
  if (obj.mongodb) {
    delete obj.mongodb.uri;
  }
  if (obj.email) {
    // Remove sensitive email credentials
    if (obj.email.resend) {
      delete obj.email.resend.apiKey;
    }
    if (obj.email.smtp) {
      delete obj.email.smtp.pass;
    }
  }
  if (obj.apiKeys) {
    delete obj.apiKeys.falApiKey;
    delete obj.apiKeys.bundleSocialApiKey;
  }
  if (obj.reddit) {
    delete obj.reddit.clientId;
    delete obj.reddit.clientSecret;
    delete obj.reddit.password;
  }
  if (obj.rapidApi) {
    delete obj.rapidApi.key;
  }
  
  return obj;
};

// Method to get settings with masked sensitive data
settingsSchema.methods.toMaskedJSON = function() {
  const obj = this.toPublicJSON();
  
  // Add masked versions
  if (this.cloudinary?.apiSecret) {
    obj.cloudinary.apiSecret = this.maskSecret(this.cloudinary.apiSecret);
  }
  if (this.mongodb?.uri) {
    obj.mongodb.uri = this.maskSecret(this.mongodb.uri);
  }
  if (this.email?.resend?.apiKey) {
    obj.email = obj.email || {};
    obj.email.resend = obj.email.resend || {};
    obj.email.resend.apiKey = this.maskSecret(this.email.resend.apiKey);
  }
  if (this.email?.smtp?.pass) {
    obj.email = obj.email || {};
    obj.email.smtp = obj.email.smtp || {};
    obj.email.smtp.pass = this.maskSecret(this.email.smtp.pass);
  }
  if (this.apiKeys?.falApiKey) {
    obj.apiKeys = obj.apiKeys || {};
    obj.apiKeys.falApiKey = this.maskSecret(this.apiKeys.falApiKey);
  }
  if (this.apiKeys?.bundleSocialApiKey) {
    obj.apiKeys = obj.apiKeys || {};
    obj.apiKeys.bundleSocialApiKey = this.maskSecret(this.apiKeys.bundleSocialApiKey);
  }
  if (this.reddit?.clientId) {
    obj.reddit = obj.reddit || {};
    obj.reddit.clientId = this.maskSecret(this.reddit.clientId);
  }
  if (this.reddit?.clientSecret) {
    obj.reddit = obj.reddit || {};
    obj.reddit.clientSecret = this.maskSecret(this.reddit.clientSecret);
  }
  if (this.reddit?.password) {
    obj.reddit = obj.reddit || {};
    obj.reddit.password = this.maskSecret(this.reddit.password);
  }
  if (this.rapidApi?.key) {
    obj.rapidApi = obj.rapidApi || {};
    obj.rapidApi.key = this.maskSecret(this.rapidApi.key);
  }
  
  return obj;
};

// Method to get full settings with all sensitive data (SUPERADMIN ONLY)
settingsSchema.methods.toFullJSON = function() {
  // Use toObject with all fields included (bypass select: false)
  const obj = this.toObject({ 
    getters: true,
    virtuals: false,
    // This doesn't actually work for select:false fields, so we'll manually add them
  });
  
  // Manually add fields that have select: false
  if (this.cloudinary?.apiSecret !== undefined) {
    obj.cloudinary = obj.cloudinary || {};
    obj.cloudinary.apiSecret = this.cloudinary.apiSecret;
  }
  
  if (this.mongodb?.uri !== undefined) {
    obj.mongodb = obj.mongodb || {};
    obj.mongodb.uri = this.mongodb.uri;
  }
  
  if (this.email?.resend?.apiKey !== undefined) {
    obj.email = obj.email || {};
    obj.email.resend = obj.email.resend || {};
    obj.email.resend.apiKey = this.email.resend.apiKey;
  }
  
  if (this.email?.smtp?.pass !== undefined) {
    obj.email = obj.email || {};
    obj.email.smtp = obj.email.smtp || {};
    obj.email.smtp.pass = this.email.smtp.pass;
  }
  
  if (this.apiKeys?.falApiKey !== undefined) {
    obj.apiKeys = obj.apiKeys || {};
    obj.apiKeys.falApiKey = this.apiKeys.falApiKey;
  }
  
  if (this.apiKeys?.bundleSocialApiKey !== undefined) {
    obj.apiKeys = obj.apiKeys || {};
    obj.apiKeys.bundleSocialApiKey = this.apiKeys.bundleSocialApiKey;
  }
  
  if (this.reddit?.clientId !== undefined) {
    obj.reddit = obj.reddit || {};
    obj.reddit.clientId = this.reddit.clientId;
  }
  
  if (this.reddit?.clientSecret !== undefined) {
    obj.reddit = obj.reddit || {};
    obj.reddit.clientSecret = this.reddit.clientSecret;
  }
  
  if (this.reddit?.password !== undefined) {
    obj.reddit = obj.reddit || {};
    obj.reddit.password = this.reddit.password;
  }
  
  if (this.rapidApi?.key !== undefined) {
    obj.rapidApi = obj.rapidApi || {};
    obj.rapidApi.key = this.rapidApi.key;
  }
  
  // Return everything including sensitive fields
  // This should ONLY be used for superadmin requests with proper authentication
  return obj;
};

// Helper method to mask sensitive strings
settingsSchema.methods.maskSecret = function(secret) {
  if (!secret || secret.length < 8) return '••••••••';
  const firstChars = secret.substring(0, 4);
  const lastChars = secret.substring(secret.length - 4);
  return `${firstChars}${'•'.repeat(secret.length - 8)}${lastChars}`;
};

// Static method to get or create settings
settingsSchema.statics.getSettings = async function() {
  // Use select('+field') to include fields with select: false
  let settings = await this.findById('app_settings')
    .select('+cloudinary.apiSecret')
    .select('+mongodb.uri')
    .select('+email.resend.apiKey')
    .select('+email.smtp.pass')
    .select('+apiKeys.falApiKey')
    .select('+apiKeys.bundleSocialApiKey')
    .select('+reddit.clientId')
    .select('+reddit.clientSecret')
    .select('+reddit.password')
    .select('+firebase.serviceAccount')
    .select('+rapidApi.key');
  
  if (!settings) {
    // Create default settings from environment variables
    settings = await this.create({
      _id: 'app_settings'
    });
    
    // Re-fetch with all fields
    settings = await this.findById('app_settings')
      .select('+cloudinary.apiSecret')
      .select('+mongodb.uri')
      .select('+email.resend.apiKey')
      .select('+email.smtp.pass')
      .select('+apiKeys.falApiKey')
      .select('+apiKeys.bundleSocialApiKey')
      .select('+reddit.clientId')
      .select('+reddit.clientSecret')
      .select('+reddit.password')
      .select('+firebase.serviceAccount')
      .select('+rapidApi.key');
  }
  
  return settings;
};

// Static method to update settings
settingsSchema.statics.updateSettings = async function(updates, adminId) {
  let settings = await this.findById('app_settings');
  
  if (!settings) {
    settings = new this({ _id: 'app_settings' });
  }
  
  // Deep merge updates
  Object.keys(updates).forEach(key => {
    if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
      settings[key] = { ...settings[key], ...updates[key] };
    } else {
      settings[key] = updates[key];
    }
  });
  
  settings.lastUpdatedBy = adminId;
  settings.lastUpdatedAt = new Date();
  
  await settings.save();
  return settings;
};

// Pre-save hook to prevent bullet character corruption in secrets
settingsSchema.pre('save', function(next) {
  const bulletRegex = /[•]/;
  const errors = [];

  // Check all sensitive fields for bullet characters
  if (this.cloudinary?.apiSecret && bulletRegex.test(this.cloudinary.apiSecret)) {
    errors.push('Cloudinary API Secret contains invalid bullet characters (•)');
  }

  if (this.mongodb?.uri && bulletRegex.test(this.mongodb.uri)) {
    errors.push('MongoDB URI contains invalid bullet characters (•)');
  }

  if (this.email?.resend?.apiKey && bulletRegex.test(this.email.resend.apiKey)) {
    errors.push('Resend API Key contains invalid bullet characters (•)');
  }

  if (this.email?.smtp?.pass && bulletRegex.test(this.email.smtp.pass)) {
    errors.push('SMTP Password contains invalid bullet characters (•)');
  }

  if (this.apiKeys?.falApiKey && bulletRegex.test(this.apiKeys.falApiKey)) {
    errors.push('Fal.ai API Key contains invalid bullet characters (•)');
  }

  if (this.apiKeys?.bundleSocialApiKey && bulletRegex.test(this.apiKeys.bundleSocialApiKey)) {
    errors.push('Bundle.social API Key contains invalid bullet characters (•)');
  }

  if (this.reddit?.clientId && bulletRegex.test(this.reddit.clientId)) {
    errors.push('Reddit Client ID contains invalid bullet characters (•)');
  }

  if (this.reddit?.clientSecret && bulletRegex.test(this.reddit.clientSecret)) {
    errors.push('Reddit Client Secret contains invalid bullet characters (•)');
  }

  if (this.reddit?.password && bulletRegex.test(this.reddit.password)) {
    errors.push('Reddit Password contains invalid bullet characters (•)');
  }

  if (this.rapidApi?.key && bulletRegex.test(this.rapidApi.key)) {
    errors.push('RapidAPI Key contains invalid bullet characters (•)');
  }

  if (errors.length > 0) {
    const error = new Error('Secret validation failed: ' + errors.join(', '));
    error.name = 'SecretValidationError';
    return next(error);
  }

  next();
});

module.exports = mongoose.model('Settings', settingsSchema);
