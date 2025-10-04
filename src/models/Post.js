const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  
  // Post content
  caption: {
    type: String,
    required: [true, 'Post caption is required'],
    maxlength: [2200, 'Caption cannot be longer than 2200 characters']
  },
  hashtags: [{
    type: String,
    trim: true
  }],
  
  // Publishing details
  platforms: [{
    name: {
      type: String,
      enum: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'],
      required: true
    },
    accountId: {
      type: String,
      required: true
    },
    postId: String, // ID from the platform after publishing
    publishedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'published', 'failed'],
      default: 'pending'
    },
    errorMessage: String
  }],
  
  // Scheduling
  scheduledFor: Date,
  publishedAt: Date,
  
  // Bundle.social integration
  bundlePostId: String, // ID from Bundle.social
  bundleStatus: {
    type: String,
    enum: ['draft', 'scheduled', 'posted', 'error', 'deleted', 'processing'],
    default: 'draft'
  },
  bundleError: String, // General error message from Bundle.social
  bundleErrors: {
    type: Map,
    of: String // Platform-specific errors
  },
  bundleExternalData: {
    type: Map,
    of: {
      id: String,
      permalink: String
    }
  },
  
  // Post settings
  settings: {
    autoPublish: {
      type: Boolean,
      default: true
    },
    allowComments: {
      type: Boolean,
      default: true
    },
    allowLikes: {
      type: Boolean,
      default: true
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public'
    }
  },
  
  // Analytics (will be populated from Bundle.social)
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    lastUpdated: Date
  }
}, {
  timestamps: true
});

// Indexes
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ bundlePostId: 1 });
postSchema.index({ scheduledFor: 1 });
postSchema.index({ 'platforms.name': 1, 'platforms.status': 1 });

module.exports = mongoose.model('Post', postSchema);