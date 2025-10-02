const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { sendUnauthorized, sendForbidden } = require('../utils/response');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    // 1) Get token from header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendUnauthorized(res, 'You are not logged in! Please log in to get access.');
    }

    // 2) Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return sendUnauthorized(res, 'The user belonging to this token does no longer exist.');
    }

    // 4) Check if user is not locked
    if (currentUser.isLocked) {
      return sendUnauthorized(res, 'Your account is temporarily locked due to too many failed login attempts.');
    }

    // 5) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return sendUnauthorized(res, 'User recently changed password! Please log in again.');
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return sendUnauthorized(res, 'Invalid token. Please log in again!');
    } else if (error.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Your token has expired! Please log in again.');
    }
    
    return sendUnauthorized(res, 'Authentication failed');
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id);
      
      if (currentUser && !currentUser.isLocked && !currentUser.changedPasswordAfter(decoded.iat)) {
        req.user = currentUser;
      }
    }

    next();
  } catch (error) {
    // Ignore errors in optional auth
    next();
  }
};

// Restrict to specific roles (can be extended for role-based access)
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendForbidden(res, 'You do not have permission to perform this action');
    }
    next();
  };
};

module.exports = {
  protect,
  optionalAuth,
  restrictTo
};