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
    geminiApiKey: {
      type: String,
      select: false, // Don't return by default for security
      default: process.env.GEMINI_API_KEY || ''
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
      default: 'support@soloai.com'
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
    delete obj.apiKeys.geminiApiKey;
    delete obj.apiKeys.bundleSocialApiKey;
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
  if (this.apiKeys?.geminiApiKey) {
    obj.apiKeys = obj.apiKeys || {};
    obj.apiKeys.geminiApiKey = this.maskSecret(this.apiKeys.geminiApiKey);
  }
  if (this.apiKeys?.bundleSocialApiKey) {
    obj.apiKeys = obj.apiKeys || {};
    obj.apiKeys.bundleSocialApiKey = this.maskSecret(this.apiKeys.bundleSocialApiKey);
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
  
  if (this.apiKeys?.geminiApiKey !== undefined) {
    obj.apiKeys = obj.apiKeys || {};
    obj.apiKeys.geminiApiKey = this.apiKeys.geminiApiKey;
  }
  
  if (this.apiKeys?.bundleSocialApiKey !== undefined) {
    obj.apiKeys = obj.apiKeys || {};
    obj.apiKeys.bundleSocialApiKey = this.apiKeys.bundleSocialApiKey;
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
    .select('+apiKeys.geminiApiKey')
    .select('+apiKeys.bundleSocialApiKey');
  
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
      .select('+apiKeys.geminiApiKey')
      .select('+apiKeys.bundleSocialApiKey');
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

  if (this.apiKeys?.geminiApiKey && bulletRegex.test(this.apiKeys.geminiApiKey)) {
    errors.push('Gemini API Key contains invalid bullet characters (•)');
  }

  if (this.apiKeys?.bundleSocialApiKey && bulletRegex.test(this.apiKeys.bundleSocialApiKey)) {
    errors.push('Bundle.social API Key contains invalid bullet characters (•)');
  }

  if (errors.length > 0) {
    const error = new Error('Secret validation failed: ' + errors.join(', '));
    error.name = 'SecretValidationError';
    return next(error);
  }

  next();
});

module.exports = mongoose.model('Settings', settingsSchema);
