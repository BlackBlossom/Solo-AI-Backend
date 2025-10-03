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
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/helpers');
const logger = require('../utils/logger');

// Register new user
const register = async (req, res, next) => {
  try {
    const { name, email, password, loginType = 'email' } = req.body;

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

    // Create user data based on login type
    const userData = {
      name,
      email,
      loginType,
      bundleOrganizationId: orgData.bundleOrganizationId,
      bundleTeamId: orgData.bundleTeamId
    };

    // Only add password for email registration
    if (loginType === 'email') {
      userData.password = password;
    }

    // Create user
    const user = await User.create(userData);

    // Generate tokens
    const accessToken = generateToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });

    // Store refresh token in database
    user.refreshToken = refreshToken;
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await user.save({ validateBeforeSave: false });

    // Send welcome email (optional for MVP)
    emailService.sendWelcomeEmail(user).catch(err => {
      logger.warn('Failed to send welcome email:', err.message);
    });

    // Remove password from response
    user.password = undefined;
    user.refreshToken = undefined;

    logger.info('User registered successfully:', { 
      userId: user._id, 
      email: user.email, 
      loginType: user.loginType 
    });

    sendCreated(res, 'User registered successfully', {
      user,
      accessToken,
      refreshToken,
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
    const { email, password, loginType = 'email' } = req.body;

    // Find user and include password field for email login
    const selectFields = loginType === 'email' ? '+password' : '';
    const user = await User.findOne({ email }).select(selectFields);
    
    if (!user) {
      return sendUnauthorized(res, 'Invalid credentials');
    }

    // Check if login type matches
    if (user.loginType !== loginType) {
      return sendUnauthorized(res, `This account is registered with ${user.loginType} login. Please use the correct login method.`);
    }

    // Check if account is locked
    if (user.isLocked) {
      return sendUnauthorized(res, 'Account is temporarily locked due to too many failed login attempts');
    }

    // For email login, check password
    if (loginType === 'email') {
      if (!password) {
        return sendBadRequest(res, 'Password is required for email login');
      }

      const isPasswordCorrect = await user.correctPassword(password, user.password);
      
      if (!isPasswordCorrect) {
        // Increment login attempts
        await user.incLoginAttempts();
        return sendUnauthorized(res, 'Invalid email or password');
      }
    }

    // For social logins (google, apple), we trust that the frontend has already validated the user
    // In production, you would verify the social login token here

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLoginAt = new Date();

    // Generate new tokens
    const accessToken = generateToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });

    // Store refresh token in database
    user.refreshToken = refreshToken;
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await user.save({ validateBeforeSave: false });

    // Remove sensitive data from response
    user.password = undefined;
    user.refreshToken = undefined;

    logger.info('User logged in successfully:', { 
      userId: user._id, 
      email: user.email, 
      loginType: user.loginType 
    });

    sendSuccess(res, 'Login successful', {
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

// Refresh access token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return sendBadRequest(res, 'Refresh token is required');
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error) {
      return sendUnauthorized(res, 'Invalid or expired refresh token');
    }

    // Find user and check if refresh token matches
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) {
      return sendUnauthorized(res, 'Invalid refresh token');
    }

    // Check if refresh token has expired
    if (user.refreshTokenExpires && user.refreshTokenExpires < new Date()) {
      return sendUnauthorized(res, 'Refresh token has expired');
    }

    // Generate new access token
    const newAccessToken = generateToken({ id: user._id });

    // Optionally generate new refresh token (for rotation)
    const newRefreshToken = generateRefreshToken({ id: user._id });
    user.refreshToken = newRefreshToken;
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await user.save({ validateBeforeSave: false });

    logger.info('Tokens refreshed successfully:', { userId: user._id });

    sendSuccess(res, 'Tokens refreshed successfully', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    next(error);
  }
};

// Logout user (invalidate refresh token)
const logout = async (req, res, next) => {
  try {
    // Clear refresh token from database
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { refreshToken: 1, refreshTokenExpires: 1 }
    });

    logger.info('User logged out:', { userId: req.user._id });
    sendSuccess(res, 'Logout successful');
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
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
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  updatePassword,
  getMe
};