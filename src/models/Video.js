const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Basic video information
  title: {
    type: String,
    required: [true, 'Video title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be longer than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be longer than 500 characters']
  },
  
  // File information (optional for direct Bundle.social uploads)
  filename: {
    type: String,
    required: false // Made optional for direct uploads
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: false // Made optional for direct uploads
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  duration: Number, // in seconds
  
  // Video metadata
  dimensions: {
    width: Number,
    height: Number
  },
  format: String,
  bitrate: Number,
  
  // Thumbnail
  thumbnailPath: String,
  thumbnailUrl: String, // Bundle.social thumbnail URL
  iconUrl: String, // Bundle.social icon URL (smaller preview)
  
  // Processing status
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed'],
    default: 'uploading'
  },
  
  // Bundle.social integration  
  bundleUploadId: {
    type: String,
    required: false, // Made optional to support existing data and partial upload flows
    validate: {
      validator: function(value) {
        // Only require bundleUploadId if storageType is bundle_social_direct
        if (this.storageType === 'bundle_social_direct') {
          return value && value.length > 0;
        }
        return true;
      },
      message: 'bundleUploadId is required when storageType is bundle_social_direct'
    }
  },
  storageType: {
    type: String,
    enum: ['local', 'bundle_social_direct'],
    default: 'bundle_social_direct' // Default to direct upload
  },
  
  // Video editing data
  edits: {
    trimStart: {
      type: Number,
      default: 0
    },
    trimEnd: Number,
    speed: {
      type: Number,
      default: 1,
      min: 0.25,
      max: 4
    },
    filters: [String],
    overlays: [{
      type: {
        type: String,
        enum: ['text', 'sticker', 'drawing']
      },
      data: mongoose.Schema.Types.Mixed,
      position: {
        x: Number,
        y: Number
      },
      timestamp: Number // when to show overlay (in seconds)
    }]
  },
  
  // AI generated content
  aiGeneratedCaption: String,
  aiGeneratedHashtags: [String],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
videoSchema.index({ user: 1, createdAt: -1 });
videoSchema.index({ status: 1 });
videoSchema.index({ bundleUploadId: 1 });

// Pre-save middleware to update updatedAt
videoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware to update User's videos array when a video is created
videoSchema.post('save', async function(doc, next) {
  try {
    // Only update if this is a new video (not an update)
    if (this.isNew) {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(
        doc.user,
        { $addToSet: { videos: doc._id } }, // $addToSet prevents duplicates
        { new: true }
      );
    }
    next();
  } catch (error) {
    console.error('Error updating user videos array:', error);
    next(error);
  }
});

// Middleware to remove video from User's videos array when deleted
videoSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(
        doc.user,
        { $pull: { videos: doc._id } }
      );
    } catch (error) {
      console.error('Error removing video from user videos array:', error);
    }
  }
});

videoSchema.post('deleteOne', async function(doc) {
  if (doc) {
    try {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(
        doc.user,
        { $pull: { videos: doc._id } }
      );
    } catch (error) {
      console.error('Error removing video from user videos array:', error);
    }
  }
});

module.exports = mongoose.model('Video', videoSchema);