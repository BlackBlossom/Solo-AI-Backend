const mongoose = require('mongoose');

const adminActivityLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login', 'logout', 'create', 'update', 'delete', 
      'bulk_delete', 'upload', 'status_change', 'settings_update', 'restrict', 'unrestrict'
    ]
  },
  resourceType: {
    type: String,
    enum: ['user', 'video', 'post', 'media', 'social_account', 'settings', 'admin'],
    required: true
  },
  resourceId: String,
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: String,
  userAgent: String,
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: String
}, {
  timestamps: true
});

// Indexes
adminActivityLogSchema.index({ admin: 1, createdAt: -1 });
adminActivityLogSchema.index({ action: 1, resourceType: 1 });
adminActivityLogSchema.index({ createdAt: -1 });
adminActivityLogSchema.index({ success: 1 });

module.exports = mongoose.model('AdminActivityLog', adminActivityLogSchema);
