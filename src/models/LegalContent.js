const mongoose = require('mongoose');

const legalContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['privacy_policy', 'terms_of_use', 'faq'],
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    htmlContent: {
      type: String,
      required: true,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
    },
    version: {
      type: Number,
      default: 1,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
legalContentSchema.index({ type: 1 });

// Method to increment version
legalContentSchema.methods.incrementVersion = function () {
  this.version += 1;
  return this.save();
};

const LegalContent = mongoose.model('LegalContent', legalContentSchema);

module.exports = LegalContent;
