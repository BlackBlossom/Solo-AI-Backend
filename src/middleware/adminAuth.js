const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const AdminUser = require('../models/AdminUser');
const AdminActivityLog = require('../models/AdminActivityLog');
const { sendError, sendUnauthorized } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Protect admin routes - verify JWT token and admin status
 */
const protectAdmin = async (req, res, next) => {
  try {
    // 1) Get token from header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendUnauthorized(res, 'Admin authentication required. Please login.');
    }

    // 2) Verify token
    let decoded;
    try {
      decoded = await promisify(jwt.verify)(token, process.env.ADMIN_JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return sendUnauthorized(res, 'Your session has expired. Please login again.');
      }
      return sendUnauthorized(res, 'Invalid authentication token');
    }

    // 3) Check if admin still exists
    const admin = await AdminUser.findById(decoded.id).select('+refreshToken');
    
    if (!admin) {
      return sendUnauthorized(res, 'Admin account no longer exists');
    }

    // 4) Check if admin is active
    if (!admin.isActive) {
      return sendUnauthorized(res, 'Your admin account has been deactivated');
    }

    // 5) Check if account is locked
    if (admin.isLocked) {
      return sendUnauthorized(res, 'Admin account is temporarily locked due to too many failed login attempts');
    }

    // 6) Attach admin to request
    req.admin = admin;
    next();
  } catch (error) {
    logger.error('Admin authentication error:', error);
    return sendError(res, 500, 'Authentication failed', error.message);
  }
};

/**
 * Restrict access based on admin role
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return sendError(res, 403, 'You do not have permission to perform this action');
    }
    next();
  };
};

/**
 * Check specific permissions
 */
const checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    // Superadmin has all permissions
    if (req.admin.role === 'superadmin') {
      return next();
    }

    // Check if admin has at least one of the required permissions
    const hasPermission = requiredPermissions.some(permission => 
      req.admin.permissions.includes(permission)
    );

    if (!hasPermission) {
      return sendError(res, 403, `You need one of these permissions: ${requiredPermissions.join(', ')}`);
    }

    next();
  };
};

/**
 * Log admin activity
 */
const logActivity = (action, resourceType) => {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;

    // Override send function to log after response
    res.send = function(data) {
      // Log activity asynchronously (don't block response)
      AdminActivityLog.create({
        admin: req.admin._id,
        action,
        resourceType,
        resourceId: req.params.id || req.body.id || null,
        details: {
          method: req.method,
          path: req.path,
          body: req.body,
          query: req.query
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        success: res.statusCode >= 200 && res.statusCode < 400
      }).catch(err => {
        logger.error('Failed to log admin activity:', err);
      });

      // Call original send
      originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  protectAdmin,
  restrictTo,
  checkPermission,
  logActivity
};
