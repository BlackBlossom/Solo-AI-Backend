const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Notification metadata
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  body: {
    type: String,
    required: [true, 'Notification body is required'],
    trim: true,
    maxlength: [500, 'Body cannot exceed 500 characters']
  },
  
  // Notification type
  type: {
    type: String,
    enum: ['announcement', 'promotion', 'content_update', 'account_alert', 'custom'],
    default: 'announcement'
  },
  
  // Targeting
  targetType: {
    type: String,
    enum: ['all', 'individual', 'segment'],
    default: 'all',
    required: true
  },
  
  // For individual targeting
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.targetType === 'individual';
    }
  },
  
  // For segment targeting (filter criteria)
  targetSegment: {
    loginType: {
      type: String,
      enum: ['email', 'google', 'apple']
    },
    status: {
      type: String,
      enum: ['active', 'banned', 'suspended']
    },
    createdAfter: Date,
    createdBefore: Date
  },
  
  // Additional data payload (optional)
  data: {
    type: Map,
    of: String,
    default: {}
  },
  
  // Deep link for in-app navigation
  deepLink: {
    type: String,
    trim: true
  },
  
  // Image URL for rich notifications
  imageUrl: {
    type: String,
    trim: true
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['high', 'normal', 'low'],
    default: 'normal'
  },
  
  // Scheduling
  scheduledFor: {
    type: Date,
    default: null
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
    default: 'draft'
  },
  
  // Delivery statistics
  stats: {
    totalTargeted: {
      type: Number,
      default: 0
    },
    totalSent: {
      type: Number,
      default: 0
    },
    totalFailed: {
      type: Number,
      default: 0
    },
    totalDelivered: {
      type: Number,
      default: 0
    }
  },
  
  // Failed device tokens (for debugging)
  failedTokens: [{
    token: String,
    error: String,
    timestamp: Date
  }],
  
  // Admin who created this notification
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  
  // Timestamps for sending
  sentAt: Date,
  completedAt: Date,
  
  // Test mode flag
  isTest: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
notificationSchema.index({ createdBy: 1, createdAt: -1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ targetType: 1, targetUser: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });

// Virtual for success rate
notificationSchema.virtual('successRate').get(function() {
  if (this.stats.totalSent === 0) return 0;
  return ((this.stats.totalSent - this.stats.totalFailed) / this.stats.totalSent * 100).toFixed(2);
});

// Method to increment stats
notificationSchema.methods.incrementStat = function(statName) {
  this.stats[statName] = (this.stats[statName] || 0) + 1;
  return this.save();
};

// Method to add failed token
notificationSchema.methods.addFailedToken = function(token, error) {
  this.failedTokens.push({
    token: token.substring(0, 20) + '...', // Store partial token for privacy
    error: error,
    timestamp: new Date()
  });
  
  // Keep only last 100 failed tokens
  if (this.failedTokens.length > 100) {
    this.failedTokens = this.failedTokens.slice(-100);
  }
  
  return this.save();
};

// Static method to get notification statistics
notificationSchema.statics.getStatistics = async function(adminId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return await this.aggregate([
    {
      $match: {
        createdBy: mongoose.Types.ObjectId(adminId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        totalSent: { $sum: '$stats.totalSent' },
        totalFailed: { $sum: '$stats.totalFailed' },
        totalDelivered: { $sum: '$stats.totalDelivered' },
        byType: {
          $push: {
            type: '$type',
            count: 1
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Notification', notificationSchema);
