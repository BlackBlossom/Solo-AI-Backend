const Notification = require('../models/Notification');
const User = require('../models/User');
const firebaseService = require('../services/firebaseService');
const { 
  sendSuccess, 
  sendCreated, 
  sendBadRequest, 
  sendNotFound,
  sendError,
  getPaginationMeta 
} = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Send notification to users
 */
const sendNotification = async (req, res, next) => {
  try {
    const {
      title,
      body,
      type,
      targetType,
      targetUserId,
      targetSegment,
      data,
      deepLink,
      imageUrl,
      priority,
      isTest
    } = req.body;

    // Create notification record
    const notification = await Notification.create({
      title,
      body,
      type: type || 'announcement',
      targetType: targetType || 'all',
      targetUser: targetUserId || null,
      targetSegment: targetSegment || {},
      data: data || {},
      deepLink: deepLink || null,
      imageUrl: imageUrl || null,
      priority: priority || 'normal',
      createdBy: req.admin._id,
      isTest: isTest || false,
      status: 'sending'
    });

    // Get target users and their tokens
    let users = [];
    let targetTokens = [];

    if (targetType === 'individual' && targetUserId) {
      // Send to single user
      const user = await User.findById(targetUserId).select('fcmTokens');
      if (!user) {
        notification.status = 'failed';
        await notification.save();
        return sendNotFound(res, 'Target user not found');
      }
      users = [user];
    } else if (targetType === 'segment' && targetSegment) {
      // Send to user segment
      const query = { 'fcmTokens.0': { $exists: true } }; // Users with at least one token
      
      if (targetSegment.loginType) {
        query.loginType = targetSegment.loginType;
      }
      if (targetSegment.status) {
        query.status = targetSegment.status;
      }
      if (targetSegment.createdAfter) {
        query.createdAt = { ...query.createdAt, $gte: new Date(targetSegment.createdAfter) };
      }
      if (targetSegment.createdBefore) {
        query.createdAt = { ...query.createdAt, $lte: new Date(targetSegment.createdBefore) };
      }

      users = await User.find(query).select('fcmTokens');
    } else {
      // Send to all users with tokens
      users = await User.find({ 'fcmTokens.0': { $exists: true } }).select('fcmTokens');
    }

    // Extract all valid tokens
    users.forEach(user => {
      user.fcmTokens.forEach(tokenObj => {
        if (tokenObj.token && tokenObj.token.trim()) {
          targetTokens.push(tokenObj.token);
        }
      });
    });

    // Update notification stats
    notification.stats.totalTargeted = targetTokens.length;
    await notification.save();

    if (targetTokens.length === 0) {
      notification.status = 'failed';
      await notification.save();
      return sendError(res, 400, 'No valid device tokens found for target users');
    }

    // Send notifications via Firebase
    const notificationPayload = {
      title: notification.title,
      body: notification.body,
      type: notification.type,
      data: Object.fromEntries(notification.data || new Map()),
      deepLink: notification.deepLink,
      imageUrl: notification.imageUrl,
      priority: notification.priority
    };

    const sendResult = await firebaseService.sendToMultipleDevices(
      targetTokens,
      notificationPayload
    );

    // Update notification stats
    notification.stats.totalSent = sendResult.successCount;
    notification.stats.totalFailed = sendResult.failureCount;
    notification.status = 'sent';
    notification.sentAt = new Date();
    notification.completedAt = new Date();

    // Store failed tokens for debugging
    if (sendResult.failureCount > 0) {
      sendResult.results
        .filter(r => !r.success)
        .slice(0, 100) // Store max 100 failures
        .forEach(r => {
          notification.failedTokens.push({
            token: r.token.substring(0, 20) + '...',
            error: r.error ? r.error.message : 'Unknown error',
            timestamp: new Date()
          });
        });
    }

    await notification.save();

    logger.info('Notification sent successfully:', {
      notificationId: notification._id,
      targetType: notification.targetType,
      totalTargeted: notification.stats.totalTargeted,
      successCount: sendResult.successCount,
      failureCount: sendResult.failureCount,
      adminId: req.admin._id
    });

    sendCreated(res, 'Notification sent successfully', {
      notification: {
        id: notification._id,
        title: notification.title,
        targetType: notification.targetType,
        stats: notification.stats,
        sentAt: notification.sentAt
      },
      sendResult: {
        successCount: sendResult.successCount,
        failureCount: sendResult.failureCount,
        totalTokens: sendResult.totalTokens
      }
    });
  } catch (error) {
    logger.error('Send notification error:', error);
    next(error);
  }
};

/**
 * Get all notifications with pagination
 */
const getAllNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    
    // Filter by type
    if (req.query.type) {
      filter.type = req.query.type;
    }

    // Filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Filter by target type
    if (req.query.targetType) {
      filter.targetType = req.query.targetType;
    }

    // Filter by admin (for non-superadmin)
    if (req.admin.role !== 'superadmin') {
      filter.createdBy = req.admin._id;
    }

    // Search in title and body
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { body: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const notifications = await Notification.find(filter)
      .populate('createdBy', 'name email role')
      .populate('targetUser', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(filter);
    const meta = getPaginationMeta(page, limit, total);

    sendSuccess(res, 'Notifications retrieved successfully', { notifications }, meta);
  } catch (error) {
    logger.error('Get all notifications error:', error);
    next(error);
  }
};

/**
 * Get single notification by ID
 */
const getNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('targetUser', 'name email profilePicture');

    if (!notification) {
      return sendNotFound(res, 'Notification not found');
    }

    // Check permission (non-superadmin can only view their own)
    if (req.admin.role !== 'superadmin' && 
        notification.createdBy._id.toString() !== req.admin._id.toString()) {
      return sendError(res, 403, 'Access denied');
    }

    sendSuccess(res, 'Notification retrieved successfully', { notification });
  } catch (error) {
    logger.error('Get notification error:', error);
    next(error);
  }
};

/**
 * Get notification statistics
 */
const getNotificationStats = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const filter = {
      createdAt: { $gte: startDate }
    };

    // Filter by admin for non-superadmin
    if (req.admin.role !== 'superadmin') {
      filter.createdBy = req.admin._id;
    }

    const stats = await Notification.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          totalSent: { $sum: '$stats.totalSent' },
          totalFailed: { $sum: '$stats.totalFailed' },
          totalTargeted: { $sum: '$stats.totalTargeted' },
          byType: {
            $push: {
              type: '$type',
              sent: '$stats.totalSent'
            }
          },
          byStatus: {
            $push: {
              status: '$status',
              count: 1
            }
          }
        }
      }
    ]);

    // Count by type
    const typeStats = {};
    const statusStats = {};

    if (stats.length > 0) {
      stats[0].byType.forEach(item => {
        typeStats[item.type] = (typeStats[item.type] || 0) + item.sent;
      });

      stats[0].byStatus.forEach(item => {
        statusStats[item.status] = (statusStats[item.status] || 0) + 1;
      });
    }

    const result = stats[0] || {
      totalNotifications: 0,
      totalSent: 0,
      totalFailed: 0,
      totalTargeted: 0
    };

    result.typeStats = typeStats;
    result.statusStats = statusStats;
    result.successRate = result.totalSent > 0 
      ? ((result.totalSent - result.totalFailed) / result.totalSent * 100).toFixed(2) 
      : 0;

    delete result._id;
    delete result.byType;
    delete result.byStatus;

    sendSuccess(res, 'Notification statistics retrieved', {
      stats: result,
      period: `Last ${days} days`
    });
  } catch (error) {
    logger.error('Get notification stats error:', error);
    next(error);
  }
};

/**
 * Test Firebase notification configuration
 */
const testNotification = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return sendBadRequest(res, 'Device token is required for testing');
    }

    // Create test notification
    const testPayload = {
      title: '🔔 Test Notification',
      body: 'This is a test notification from Solo AI Admin Panel',
      type: 'custom',
      data: {
        test: 'true',
        timestamp: new Date().toISOString()
      },
      priority: 'high'
    };

    const result = await firebaseService.sendToDevice(token, testPayload);

    if (result.success) {
      logger.info('Test notification sent successfully:', {
        adminId: req.admin._id,
        messageId: result.messageId
      });

      sendSuccess(res, 'Test notification sent successfully', {
        messageId: result.messageId,
        token: token.substring(0, 20) + '...'
      });
    } else {
      logger.error('Test notification failed:', {
        adminId: req.admin._id,
        error: result.error
      });

      sendError(res, 400, 'Failed to send test notification', {
        error: result.error,
        errorCode: result.errorCode
      });
    }
  } catch (error) {
    logger.error('Test notification error:', error);
    next(error);
  }
};

/**
 * Check Firebase service health
 */
const checkFirebaseHealth = async (req, res, next) => {
  try {
    const health = await firebaseService.checkHealth();

    if (health.healthy) {
      sendSuccess(res, 'Firebase service is healthy', { health });
    } else {
      res.status(503).json({
        status: 'error',
        message: 'Firebase service is unavailable',
        data: { health }
      });
    }
  } catch (error) {
    logger.error('Check Firebase health error:', error);
    next(error);
  }
};

/**
 * Get target user count for notification preview
 */
const getTargetUserCount = async (req, res, next) => {
  try {
    const { targetType, targetUserId, targetSegment } = req.body;

    let count = 0;

    if (targetType === 'individual' && targetUserId) {
      const user = await User.findById(targetUserId).select('fcmTokens');
      count = user && user.fcmTokens.length > 0 ? 1 : 0;
    } else if (targetType === 'segment' && targetSegment) {
      const query = { 'fcmTokens.0': { $exists: true } };
      
      if (targetSegment.loginType) {
        query.loginType = targetSegment.loginType;
      }
      if (targetSegment.status) {
        query.status = targetSegment.status;
      }
      if (targetSegment.createdAfter) {
        query.createdAt = { ...query.createdAt, $gte: new Date(targetSegment.createdAfter) };
      }
      if (targetSegment.createdBefore) {
        query.createdAt = { ...query.createdAt, $lte: new Date(targetSegment.createdBefore) };
      }

      count = await User.countDocuments(query);
    } else {
      // All users with tokens
      count = await User.countDocuments({ 'fcmTokens.0': { $exists: true } });
    }

    sendSuccess(res, 'Target user count retrieved', {
      targetType: targetType || 'all',
      userCount: count
    });
  } catch (error) {
    logger.error('Get target user count error:', error);
    next(error);
  }
};

module.exports = {
  sendNotification,
  getAllNotifications,
  getNotification,
  getNotificationStats,
  testNotification,
  checkFirebaseHealth,
  getTargetUserCount
};
