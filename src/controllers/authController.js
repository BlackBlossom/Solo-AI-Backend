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
const { generateToken, generateRefreshToken, verifyRefreshToken, generateOtp, hashOtp } = require('../utils/helpers');
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

    // Create user data based on login type
    const userData = {
      name,
      email,
      loginType,
      bundleRegistered: false // Will be set to true when Bundle.social setup is completed
    };

    // Only add password for email registration
    if (loginType === 'email') {
      userData.password = password;
    }

    // Create user (without Bundle.social setup)
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
      bundleRegistered: false,
      message: 'You can start using the app. Bundle.social integration will be set up when you upload your first video.'
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

// Reset password (Simplified - only requires email and password after OTP verification)
const resetPassword = async (req, res, next) => {
  try {
    const { email, password, confirmPassword } = req.body;

    // Validate passwords match
    if (password !== confirmPassword) {
      return sendBadRequest(res, 'Passwords do not match');
    }

    // Find user with verified OTP
    const user = await User.findOne({
      email,
      passwordResetOtpVerified: true,
      passwordResetOtpExpires: { $gt: Date.now() } // OTP should still be valid
    });

    if (!user) {
      return sendBadRequest(res, 'Password reset not authorized. Please verify your OTP first.');
    }

    // Update password
    user.password = password;
    user.passwordChangedAt = Date.now();
    
    // Clear OTP fields
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpires = undefined;
    user.passwordResetOtpVerified = undefined;

    await user.save();

    // Generate new JWT token
    const jwtToken = generateToken({ id: user._id });

    logger.info('Password reset successfully:', { userId: user._id });

    sendSuccess(res, 'Password reset successful', {
      token: jwtToken,
      message: 'Your password has been reset successfully. You can now login with your new password.'
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

// Get Bundle.social registration status
const getBundleStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    const status = {
      bundleRegistered: user.bundleRegistered || false,
      hasTeamId: !!user.bundleTeamId,
      hasOrganizationId: !!user.bundleOrganizationId,
      bundleTeamId: user.bundleTeamId || null,
      bundleOrganizationId: user.bundleOrganizationId || null
    };

    logger.info('Bundle.social status checked:', { userId: user._id, status: status.bundleRegistered });

    sendSuccess(res, 'Bundle.social status retrieved', { status });
  } catch (error) {
    logger.error('Get Bundle status error:', error);
    next(error);
  }
};

// Manually trigger Bundle.social registration
const registerBundle = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    // Check if already registered
    if (user.bundleRegistered && user.bundleTeamId && user.bundleOrganizationId) {
      return sendSuccess(res, 'Bundle.social already registered', {
        bundleTeamId: user.bundleTeamId,
        bundleOrganizationId: user.bundleOrganizationId,
        message: 'Your Bundle.social integration is already active'
      });
    }

    // Setup Bundle.social
    logger.info('Manual Bundle.social registration triggered:', { userId: user._id });

    const orgData = await organizationService.setupUserOrganization({
      name: user.name,
      email: user.email,
      _id: user._id
    });

    // Update user
    user.bundleOrganizationId = orgData.bundleOrganizationId;
    user.bundleTeamId = orgData.bundleTeamId;
    user.bundleRegistered = true;
    await user.save({ validateBeforeSave: false });

    logger.info('Manual Bundle.social registration completed:', {
      userId: user._id,
      teamId: user.bundleTeamId
    });

    sendSuccess(res, 'Bundle.social registered successfully', {
      bundleTeamId: user.bundleTeamId,
      bundleOrganizationId: user.bundleOrganizationId,
      organization: orgData.teamData,
      message: 'Bundle.social integration is now active. You can now upload videos and create posts.'
    });
  } catch (error) {
    logger.error('Register Bundle error:', error);
    
    // Provide more specific error message
    if (error.message.includes('Bundle.social')) {
      return sendBadRequest(res, 'Failed to register with Bundle.social. Please try again later.');
    }
    
    next(error);
  }
};

// Send email verification OTP
const sendEmailOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return sendNotFound(res, 'No user found with that email address');
    }

    // Check if email is already verified
    if (user.emailVerified) {
      return sendBadRequest(res, 'Email is already verified');
    }

    // Generate 6-digit OTP
    const otp = generateOtp();
    
    // Hash the OTP and save to database
    user.emailOtp = hashOtp(otp);
    user.emailOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    const emailResult = await emailService.sendEmailOtp(user, otp);
    
    if (!emailResult.success) {
      user.emailOtp = undefined;
      user.emailOtpExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      return sendBadRequest(res, 'There was an error sending the email. Please try again later.');
    }

    logger.info('Email verification OTP sent:', { userId: user._id, email: user.email });

    sendSuccess(res, 'OTP sent to your email address', { 
      message: 'Please check your email for the verification code',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    logger.error('Send email OTP error:', error);
    next(error);
  }
};

// Verify email OTP
const verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!otp || otp.length !== 6) {
      return sendBadRequest(res, 'Please provide a valid 6-digit OTP');
    }

    // Hash the provided OTP
    const hashedOtp = hashOtp(otp);

    // Find user with valid OTP
    const user = await User.findOne({
      email,
      emailOtp: hashedOtp,
      emailOtpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return sendBadRequest(res, 'Invalid or expired OTP');
    }

    // Mark email as verified
    user.emailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;

    await user.save({ validateBeforeSave: false });

    logger.info('Email verified successfully:', { userId: user._id, email: user.email });

    sendSuccess(res, 'Email verified successfully', {
      emailVerified: true
    });
  } catch (error) {
    logger.error('Verify email OTP error:', error);
    next(error);
  }
};

// Send password reset OTP (replaces old forgotPassword token method)
const sendPasswordResetOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return sendNotFound(res, 'No user found with that email address');
    }

    // Check if user is using email login
    if (user.loginType !== 'email') {
      return sendBadRequest(res, `This account uses ${user.loginType} login. Password reset is not available for social logins.`);
    }

    // Generate 6-digit OTP
    const otp = generateOtp();
    
    // Hash the OTP and save to database
    user.passwordResetOtp = hashOtp(otp);
    user.passwordResetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.passwordResetOtpVerified = false;
    
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    const emailResult = await emailService.sendPasswordResetOtp(user, otp);
    
    if (!emailResult.success) {
      user.passwordResetOtp = undefined;
      user.passwordResetOtpExpires = undefined;
      user.passwordResetOtpVerified = false;
      await user.save({ validateBeforeSave: false });
      
      return sendBadRequest(res, 'There was an error sending the email. Please try again later.');
    }

    logger.info('Password reset OTP sent:', { userId: user._id, email: user.email });

    sendSuccess(res, 'Password reset OTP sent to your email', { 
      message: 'Please check your email for the verification code',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    logger.error('Send password reset OTP error:', error);
    next(error);
  }
};

// Verify password reset OTP
const verifyPasswordResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!otp || otp.length !== 6) {
      return sendBadRequest(res, 'Please provide a valid 6-digit OTP');
    }

    // Hash the provided OTP
    const hashedOtp = hashOtp(otp);

    // Find user with valid OTP
    const user = await User.findOne({
      email,
      passwordResetOtp: hashedOtp,
      passwordResetOtpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return sendBadRequest(res, 'Invalid or expired OTP');
    }

    // Mark OTP as verified (but don't clear it yet - needed for password reset)
    user.passwordResetOtpVerified = true;
    await user.save({ validateBeforeSave: false });

    logger.info('Password reset OTP verified:', { userId: user._id, email: user.email });

    sendSuccess(res, 'OTP verified successfully', {
      message: 'You can now reset your password',
      verified: true
    });
  } catch (error) {
    logger.error('Verify password reset OTP error:', error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  resetPassword,
  updatePassword,
  getMe,
  getBundleStatus,
  registerBundle,
  sendEmailOtp,
  verifyEmailOtp,
  sendPasswordResetOtp,
  verifyPasswordResetOtp
};