const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Media title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['image', 'sticker', 'gif', 'audio', 'font'],
    required: [true, 'Media type is required']
  },
  category: {
    type: String,
    enum: ['overlay', 'effect', 'transition', 'music', 'soundfx', 'filter', 'background', 'template', 'typography', 'other'],
    required: [true, 'Category is required']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Cloudinary integration
  cloudinaryUrl: {
    type: String,
    required: [true, 'Cloudinary URL is required']
  },
  cloudinaryPublicId: {
    type: String,
    required: [true, 'Cloudinary public ID is required'],
    unique: true
  },
  cloudinaryFolder: String,
  
  // File metadata
  fileSize: {
    type: Number, // in bytes
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  dimensions: {
    width: Number,
    height: Number
  },
  duration: Number, // for audio/video in seconds
  
  // Thumbnail for video/audio
  thumbnailUrl: String,
  thumbnailPublicId: String,
  
  // Status and usage
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  
  // Admin tracking
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  
  // SEO and search
  searchKeywords: [String],
  
  // Versioning
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
mediaSchema.index({ type: 1, category: 1 });
mediaSchema.index({ tags: 1 });
mediaSchema.index({ isActive: 1, createdAt: -1 });
mediaSchema.index({ cloudinaryPublicId: 1 });
mediaSchema.index({ uploadedBy: 1 });

// Text index for search
mediaSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
  searchKeywords: 'text'
});

// Static method to increment usage count
mediaSchema.statics.incrementUsage = async function(mediaId) {
  return this.findByIdAndUpdate(
    mediaId,
    { $inc: { usageCount: 1 } },
    { new: true }
  );
};

module.exports = mongoose.model('Media', mediaSchema);
