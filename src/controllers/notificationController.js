const User = require('../models/User');
const { 
  sendSuccess, 
  sendCreated, 
  sendBadRequest, 
  sendError 
} = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Register or update FCM device token for user
 */
const registerDeviceToken = async (req, res, next) => {
  try {
    const { token, deviceId, platform } = req.body;

    if (!token || !token.trim()) {
      return sendBadRequest(res, 'Device token is required');
    }

    if (!platform || !['android', 'ios', 'web'].includes(platform.toLowerCase())) {
      return sendBadRequest(res, 'Platform must be one of: android, ios, web');
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Check if token already exists
    const existingTokenIndex = user.fcmTokens.findIndex(
      t => t.token === token
    );

    if (existingTokenIndex !== -1) {
      // Update existing token
      user.fcmTokens[existingTokenIndex].lastUsed = new Date();
      user.fcmTokens[existingTokenIndex].deviceId = deviceId || user.fcmTokens[existingTokenIndex].deviceId;
      user.fcmTokens[existingTokenIndex].platform = platform.toLowerCase();
    } else {
      // Add new token
      user.fcmTokens.push({
        token: token,
        deviceId: deviceId || `device_${Date.now()}`,
        platform: platform.toLowerCase(),
        addedAt: new Date(),
        lastUsed: new Date()
      });
    }

    await user.save();

    logger.info('Device token registered:', {
      userId: user._id,
      platform: platform,
      totalTokens: user.fcmTokens.length
    });

    sendSuccess(res, 'Device token registered successfully', {
      tokenCount: user.fcmTokens.length,
      platform: platform.toLowerCase()
    });
  } catch (error) {
    logger.error('Register device token error:', error);
    next(error);
  }
};

/**
 * Remove FCM device token for user
 */
const removeDeviceToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token || !token.trim()) {
      return sendBadRequest(res, 'Device token is required');
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const originalLength = user.fcmTokens.length;
    user.fcmTokens = user.fcmTokens.filter(t => t.token !== token);

    if (user.fcmTokens.length === originalLength) {
      return sendBadRequest(res, 'Token not found');
    }

    await user.save();

    logger.info('Device token removed:', {
      userId: user._id,
      remainingTokens: user.fcmTokens.length
    });

    sendSuccess(res, 'Device token removed successfully', {
      tokenCount: user.fcmTokens.length
    });
  } catch (error) {
    logger.error('Remove device token error:', error);
    next(error);
  }
};

/**
 * Get user's registered device tokens
 */
const getDeviceTokens = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('fcmTokens');

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Return sanitized token data (partial tokens for security)
    const tokens = user.fcmTokens.map(t => ({
      deviceId: t.deviceId,
      platform: t.platform,
      tokenPreview: t.token.substring(0, 20) + '...',
      addedAt: t.addedAt,
      lastUsed: t.lastUsed
    }));

    sendSuccess(res, 'Device tokens retrieved successfully', {
      tokens: tokens,
      count: tokens.length
    });
  } catch (error) {
    logger.error('Get device tokens error:', error);
    next(error);
  }
};

/**
 * Clear all device tokens for user (logout from all devices)
 */
const clearAllDeviceTokens = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const removedCount = user.fcmTokens.length;
    user.fcmTokens = [];
    await user.save();

    logger.info('All device tokens cleared:', {
      userId: user._id,
      removedCount: removedCount
    });

    sendSuccess(res, 'All device tokens cleared successfully', {
      removedCount: removedCount
    });
  } catch (error) {
    logger.error('Clear all device tokens error:', error);
    next(error);
  }
};

module.exports = {
  registerDeviceToken,
  removeDeviceToken,
  getDeviceTokens,
  clearAllDeviceTokens
};
