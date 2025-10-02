const mongoose = require('mongoose');

const socialAccountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Platform details
  platform: {
    type: String,
    enum: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'],
    required: true
  },
  platformAccountId: {
    type: String,
    required: true
  },
  platformUsername: {
    type: String,
    required: false
  },
  platformDisplayName: String,
  
  // Bundle.social integration
  bundleAccountId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isConnected: {
    type: Boolean,
    default: true
  },
  
  // Connection details
  connectedAt: {
    type: Date,
    default: Date.now
  },
  lastSyncAt: Date,
  
  // Account metadata
  metadata: {
    profilePicture: String,
    followerCount: Number,
    followingCount: Number,
    postCount: Number,
    isVerified: {
      type: Boolean,
      default: false
    },
    businessAccount: {
      type: Boolean,
      default: false
    }
  },
  
  // Platform-specific settings
  settings: {
    defaultVisibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public'
    },
    autoPublish: {
      type: Boolean,
      default: false
    },
    defaultHashtags: [String]
  }
}, {
  timestamps: true
});

// Indexes
socialAccountSchema.index({ user: 1, platform: 1 });
socialAccountSchema.index({ bundleAccountId: 1 });
socialAccountSchema.index({ platformAccountId: 1, platform: 1 });

// Compound index to ensure user can't connect same platform account twice
socialAccountSchema.index({ user: 1, platform: 1, platformAccountId: 1 }, { unique: true });

module.exports = mongoose.model('SocialAccount', socialAccountSchema);