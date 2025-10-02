const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const organizationService = require('../services/organizationService');
const emailService = require('../services/emailService');
const { 
  sendSuccess, 
  sendCreated, 
  sendBadRequest, 
  sendUnauthorized, 
  sendNotFound 
} = require('../utils/response');
const { generateToken } = require('../utils/helpers');
const logger = require('../utils/logger');

// Register new user
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendBadRequest(res, 'User with this email already exists');
    }

    // Setup organization for user
    const orgData = await organizationService.setupUserOrganization({ 
      name, 
      email,
      _id: 'temp' // Will be replaced with actual ID after user creation
    });

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      bundleOrganizationId: orgData.bundleOrganizationId,
      bundleTeamId: orgData.bundleTeamId
    });

    // Generate JWT token
    const token = generateToken({ id: user._id });

    // Send welcome email (optional for MVP)
    emailService.sendWelcomeEmail(user).catch(err => {
      logger.warn('Failed to send welcome email:', err.message);
    });

    // Remove password from response
    user.password = undefined;

    logger.info('User registered successfully:', { userId: user._id, email: user.email });

    sendCreated(res, 'User registered successfully', {
      user,
      token,
      organization: orgData.teamData
    });
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return sendUnauthorized(res, 'Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked) {
      return sendUnauthorized(res, 'Account is temporarily locked due to too many failed login attempts');
    }

    // Check password
    const isPasswordCorrect = await user.correctPassword(password, user.password);
    
    if (!isPasswordCorrect) {
      // Increment login attempts
      await user.incLoginAttempts();
      return sendUnauthorized(res, 'Invalid email or password');
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate JWT token
    const token = generateToken({ id: user._id });

    // Remove password from response
    user.password = undefined;

    logger.info('User logged in successfully:', { userId: user._id, email: user.email });

    sendSuccess(res, 'Login successful', {
      user,
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

// Logout user (client-side token removal)
const logout = (req, res) => {
  logger.info('User logged out:', { userId: req.user._id });
  sendSuccess(res, 'Logout successful');
};

// Forgot password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return sendNotFound(res, 'No user found with that email address');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash the token and save to database
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    await user.save({ validateBeforeSave: false });

    // Send password reset email
    const emailResult = await emailService.sendPasswordResetEmail(user, resetToken);
    
    if (!emailResult.success) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      return sendBadRequest(res, 'There was an error sending the email. Please try again later.');
    }

    logger.info('Password reset email sent:', { userId: user._id, email: user.email });

    sendSuccess(res, 'Password reset token sent to email');
  } catch (error) {
    logger.error('Forgot password error:', error);
    next(error);
  }
};

// Reset password
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Hash the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return sendBadRequest(res, 'Token is invalid or has expired');
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();

    await user.save();

    // Generate new JWT token
    const jwtToken = generateToken({ id: user._id });

    logger.info('Password reset successfully:', { userId: user._id });

    sendSuccess(res, 'Password reset successful', {
      token: jwtToken
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    next(error);
  }
};

// Update password (for authenticated users)
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isCurrentPasswordCorrect = await user.correctPassword(currentPassword, user.password);
    
    if (!isCurrentPasswordCorrect) {
      return sendBadRequest(res, 'Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new JWT token
    const token = generateToken({ id: user._id });

    logger.info('Password updated successfully:', { userId: user._id });

    sendSuccess(res, 'Password updated successfully', {
      token
    });
  } catch (error) {
    logger.error('Update password error:', error);
    next(error);
  }
};

// Get current user
const getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  sendSuccess(res, 'User data retrieved', { user });
};

module.exports = {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  updatePassword,
  getMe
};