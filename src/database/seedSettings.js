const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import Settings model
const Settings = require('../models/Settings');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}`)
};

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URI);
    log.success('Connected to MongoDB');
  } catch (error) {
    log.error(`Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

// Mask sensitive values for display
const maskValue = (value) => {
  if (!value || value.length < 8) return '(not set)';
  return `${value.substring(0, 4)}${'•'.repeat(value.length - 8)}${value.substring(value.length - 4)}`;
};

// Seed Settings from environment variables
const seedSettings = async () => {
  try {
    await connectDB();

    log.section('📋 Reading Environment Variables');

    // Build settings object from environment variables
    const settingsData = {
      _id: 'app_settings',
      
      // Cloudinary Settings
      cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || ''
      },

      // MongoDB Settings
      mongodb: {
        uri: process.env.DATABASE_URI || ''
      },

      // Email Settings
      email: {
        provider: 'resend',
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

      // Video Upload Settings
      videoUpload: {
        maxFileSize: 100,
        allowedFormats: ['mp4', 'avi', 'mov', 'wmv', 'quicktime'],
        uploadPath: './uploads/videos'
      },

      // API Keys
      apiKeys: {
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        bundleSocialApiKey: process.env.BUNDLE_SOCIAL_API_KEY || '',
        bundleSocialOrgId: process.env.BUNDLE_SOCIAL_ORG_ID || ''
      },

      // Reddit API Configuration
      reddit: {
        clientId: process.env.REDDIT_CLIENT_ID || '',
        clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
        username: process.env.REDDIT_USERNAME || '',
        password: process.env.REDDIT_PASSWORD || '',
        userAgent: process.env.REDDIT_USER_AGENT || 'SoloAI/1.0.0'
      },

      // Inspiration API Settings
      inspiration: {
        cacheTTL: parseInt(process.env.INSPIRATION_CACHE_TTL) || 86400
      },

      // URL Settings
      urls: {
        productionUrl: process.env.PRODUCTION_URL || 'https://api.soloai.com',
        frontendUrl: process.env.FRONTEND_URL || 'https://app.soloai.com'
      },

      // Application Settings
      app: {
        name: 'Solo AI',
        description: 'AI-powered video editing platform',
        supportEmail: 'support@soloai.app',
        reportProblemEmail: 'support@soloai.app',
        maintenanceMode: false,
        allowNewRegistrations: true
      },

      // Feature Flags
      features: {
        videoEditingEnabled: true,
        socialMediaIntegrationEnabled: true,
        aiAssistantEnabled: true,
        adminPanelEnabled: true
      }
    };

    log.section('🔍 Configuration Summary');

    // Display configuration (masked)
    console.log('\n📦 Cloudinary:');
    log.info(`   Cloud Name: ${settingsData.cloudinary.cloudName || '(not set)'}`);
    log.info(`   API Key: ${settingsData.cloudinary.apiKey || '(not set)'}`);
    log.info(`   API Secret: ${maskValue(settingsData.cloudinary.apiSecret)}`);

    console.log('\n💾 MongoDB:');
    log.info(`   URI: ${maskValue(settingsData.mongodb.uri)}`);

    console.log('\n📧 Email (Provider: ${settingsData.email.provider}):');
    log.info(`   Resend API Key: ${maskValue(settingsData.email.resend.apiKey)}`);
    log.info(`   From Email: ${settingsData.email.resend.fromEmail}`);
    log.info(`   SMTP Host: ${settingsData.email.smtp.host}`);
    log.info(`   SMTP User: ${settingsData.email.smtp.user || '(not set)'}`);

    console.log('\n🎥 Video Upload:');
    log.info(`   Max File Size: ${settingsData.videoUpload.maxFileSize}MB`);
    log.info(`   Allowed Formats: ${settingsData.videoUpload.allowedFormats.join(', ')}`);

    console.log('\n🔑 API Keys:');
    log.info(`   Gemini API Key: ${maskValue(settingsData.apiKeys.geminiApiKey)}`);
    log.info(`   Bundle.social API Key: ${maskValue(settingsData.apiKeys.bundleSocialApiKey)}`);
    log.info(`   Bundle.social Org ID: ${settingsData.apiKeys.bundleSocialOrgId || '(not set)'}`);

    console.log('\n🤖 Reddit API:');
    log.info(`   Client ID: ${maskValue(settingsData.reddit.clientId)}`);
    log.info(`   Client Secret: ${maskValue(settingsData.reddit.clientSecret)}`);
    log.info(`   Username: ${settingsData.reddit.username || '(not set)'}`);
    log.info(`   Password: ${maskValue(settingsData.reddit.password)}`);
    log.info(`   User Agent: ${settingsData.reddit.userAgent}`);

    console.log('\n💡 Inspiration API:');
    log.info(`   Cache TTL: ${settingsData.inspiration.cacheTTL} seconds (${settingsData.inspiration.cacheTTL / 3600} hours)`);

    console.log('\n🌐 URLs:');
    log.info(`   Production URL: ${settingsData.urls.productionUrl}`);
    log.info(`   Frontend URL: ${settingsData.urls.frontendUrl}`);

    console.log('\n⚙️  Application:');
    log.info(`   Name: ${settingsData.app.name}`);
    log.info(`   Support Email: ${settingsData.app.supportEmail}`);
    log.info(`   Maintenance Mode: ${settingsData.app.maintenanceMode ? 'ON' : 'OFF'}`);
    log.info(`   New Registrations: ${settingsData.app.allowNewRegistrations ? 'ALLOWED' : 'DISABLED'}`);

    log.section('💾 Saving to Database');

    // Check if settings already exist
    const existingSettings = await Settings.findById('app_settings');

    if (existingSettings) {
      log.warning('Settings document already exists!');
      log.info('Updating existing settings...');
      
      // Update existing settings
      Object.keys(settingsData).forEach(key => {
        if (key !== '_id') {
          if (typeof settingsData[key] === 'object' && !Array.isArray(settingsData[key])) {
            existingSettings[key] = { ...existingSettings[key], ...settingsData[key] };
          } else {
            existingSettings[key] = settingsData[key];
          }
        }
      });

      await existingSettings.save();
      log.success('Settings updated successfully!');
    } else {
      log.info('Creating new settings document...');
      
      // Create new settings
      const newSettings = new Settings(settingsData);
      await newSettings.save();
      log.success('Settings created successfully!');
    }

    log.section('✨ Settings Seeded Successfully!');

    console.log('\n📝 Next Steps:');
    console.log('   1. Verify settings in admin panel: GET /api/v1/admin/settings');
    console.log('   2. Test Reddit API: GET /api/v1/inspiration/search?topic=test');
    console.log('   3. Update any settings via admin panel if needed');

    console.log('\n⚠️  Security Reminder:');
    console.log('   - Sensitive credentials are now stored in database');
    console.log('   - You can remove them from .env file (optional)');
    console.log('   - Use admin panel to update credentials going forward');
    console.log('   - Database backups should be encrypted');

  } catch (error) {
    log.error(`Seeding failed: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    log.info('Database connection closed');
    process.exit(0);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedSettings();
}

module.exports = seedSettings;
