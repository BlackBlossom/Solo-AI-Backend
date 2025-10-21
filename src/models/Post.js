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
  
  // Video thumbnail (cached from video for quick access)
  thumbnailUrl: {
    type: String
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

// Middleware to update User's posts array when a post is created
postSchema.post('save', async function(doc, next) {
  try {
    // Only update if this is a new post (not an update)
    if (this.isNew) {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(
        doc.user,
        { $addToSet: { posts: doc._id } }, // $addToSet prevents duplicates
        { new: true }
      );
    }
    next();
  } catch (error) {
    console.error('Error updating user posts array:', error);
    next(error);
  }
});

// Middleware to remove post from User's posts array when deleted
postSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(
        doc.user,
        { $pull: { posts: doc._id } }
      );
    } catch (error) {
      console.error('Error removing post from user posts array:', error);
    }
  }
});

postSchema.post('deleteOne', async function(doc) {
  if (doc) {
    try {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(
        doc.user,
        { $pull: { posts: doc._id } }
      );
    } catch (error) {
      console.error('Error removing post from user posts array:', error);
    }
  }
});

module.exports = mongoose.model('Post', postSchema);