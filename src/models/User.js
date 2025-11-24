const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
    trim: true,
    maxlength: [50, 'Name cannot be longer than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: function() {
      return this.loginType === 'email';
    },
    minlength: 8,
    select: false
  },
  
  // Authentication type
  loginType: {
    type: String,
    enum: ['email', 'google', 'apple'],
    required: true,
    default: 'email'
  },
  
  // Additional personal details
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    lowercase: true
  },
  phoneNumber: {
    type: String,
    validate: {
      validator: function(value) {
        return !value || /^\+?[\d\s\-\(\)]{10,15}$/.test(value);
      },
      message: 'Please provide a valid phone number'
    }
  },
  profilePicture: {
    type: String,
    default: null
  },
  
  // Account status
  status: {
    type: String,
    enum: ['active', 'banned', 'suspended'],
    default: 'active'
  },
  banReason: {
    type: String
  },
  banExpiry: {
    type: Date
  },
  
  // Email verification
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  
  // Email OTP verification
  emailOtp: String,
  emailOtpExpires: Date,
  
  // Password reset OTP (removed token-based fields)
  passwordResetOtp: String,
  passwordResetOtpExpires: Date,
  passwordResetOtpVerified: {
    type: Boolean,
    default: false
  },
  passwordChangedAt: Date,
  
  // Refresh token for JWT
  refreshToken: String,
  refreshTokenExpires: Date,
  
  // Account security
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  
  // Bundle.social integration (optional - created on-demand)
  bundleOrganizationId: {
    type: String,
    required: false
  },
  bundleTeamId: {
    type: String,
    required: false,
    sparse: true, // Allows multiple null values while maintaining uniqueness for non-null values
    unique: true
  },
  bundleRegistered: {
    type: Boolean,
    default: false
  },
  
  // For analytics and social accounts - following specification
  socialAccounts: [{
    socialAccountId: String,   // From Bundle.social
    platform: String,          // e.g., "INSTAGRAM"
    username: String,
    displayName: String,
    profilePicture: String,
    // ...other fetched/cached data
  }],

  // For posts/videos - following specification
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  videos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video'
  }],

  // User preferences
  preferences: {
    defaultPlatforms: [{
      type: String,
      enum: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin']
    }]
  },
  
  // FCM (Firebase Cloud Messaging) device tokens for push notifications
  fcmTokens: [{
    token: {
      type: String,
      required: true
    },
    deviceId: {
      type: String,
      default: function() {
        return `device_${Date.now()}`;
      }
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: Date
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ bundleTeamId: 1 });

// Virtual for account locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for account banned
userSchema.virtual('isBanned').get(function() {
  // Check if status is banned and not expired
  if (this.status === 'banned') {
    if (!this.banExpiry || this.banExpiry > Date.now()) {
      return true;
    }
    // Ban has expired, will be handled by pre-login check
    return false;
  }
  return false;
});

// Virtual for account suspended
userSchema.virtual('isSuspended').get(function() {
  return this.status === 'suspended';
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Pre-save middleware to set passwordChangedAt
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Instance method to check password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { loginAttempts: 1, lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to check and clear expired ban
userSchema.methods.checkBanExpiry = async function() {
  if (this.status === 'banned' && this.banExpiry && this.banExpiry < Date.now()) {
    // Ban has expired, reactivate account
    this.status = 'active';
    this.banReason = undefined;
    this.banExpiry = undefined;
    await this.save({ validateBeforeSave: false });
    return { expired: true, message: 'Your ban has expired. Account has been reactivated.' };
  }
  return { expired: false };
};

// Method to get ban/suspension details
userSchema.methods.getAccountStatusMessage = function() {
  if (this.status === 'banned') {
    const message = this.banReason 
      ? `Your account has been banned. Reason: ${this.banReason}`
      : 'Your account has been banned.';
    
    if (this.banExpiry) {
      const expiryDate = new Date(this.banExpiry).toLocaleDateString();
      return `${message} This ban will expire on ${expiryDate}.`;
    }
    return `${message} This is a permanent ban.`;
  }
  
  if (this.status === 'suspended') {
    return this.banReason 
      ? `Your account has been suspended. Reason: ${this.banReason}`
      : 'Your account has been suspended. Please contact support.';
  }
  
  return null;
};

module.exports = mongoose.model('User', userSchema);