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
  
  // File information
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
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
  
  // Processing status
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed'],
    default: 'uploading'
  },
  
  // Bundle.social integration
  bundleUploadId: String, // ID from Bundle.social after upload
  
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

module.exports = mongoose.model('Video', videoSchema);