const User = require('../models/User');
const { 
  sendSuccess, 
  sendBadRequest, 
  sendNotFound,
  getPaginationMeta 
} = require('../utils/response');
const logger = require('../utils/logger');

// Get user profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    sendSuccess(res, 'Profile retrieved successfully', { user });
  } catch (error) {
    logger.error('Get profile error:', error);
    next(error);
  }
};

// Update user profile
const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'preferences'];
    const updateData = {};

    // Filter allowed fields
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    logger.info('Profile updated successfully:', { userId: user._id });

    sendSuccess(res, 'Profile updated successfully', { user });
  } catch (error) {
    logger.error('Update profile error:', error);
    next(error);
  }
};

// Update user preferences
const updatePreferences = async (req, res, next) => {
  try {
    const { preferences } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferences },
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    logger.info('Preferences updated successfully:', { userId: user._id });

    sendSuccess(res, 'Preferences updated successfully', { 
      preferences: user.preferences 
    });
  } catch (error) {
    logger.error('Update preferences error:', error);
    next(error);
  }
};

// Upload profile picture
const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendBadRequest(res, 'Please upload a profile picture');
    }

    const profilePicturePath = `/uploads/thumbnails/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture: profilePicturePath },
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    logger.info('Profile picture uploaded:', { userId: user._id, path: profilePicturePath });

    sendSuccess(res, 'Profile picture uploaded successfully', {
      profilePicture: user.profilePicture
    });
  } catch (error) {
    logger.error('Upload profile picture error:', error);
    next(error);
  }
};

// Delete user account
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Verify password
    const isPasswordCorrect = await user.correctPassword(password, user.password);
    
    if (!isPasswordCorrect) {
      return sendBadRequest(res, 'Password is incorrect');
    }

    // In a real app, you might want to:
    // 1. Delete all user's videos and posts
    // 2. Disconnect social accounts
    // 3. Cancel subscriptions
    // 4. Send confirmation email

    await User.findByIdAndDelete(req.user.id);

    logger.info('User account deleted:', { userId: req.user.id });

    sendSuccess(res, 'Account deleted successfully');
  } catch (error) {
    logger.error('Delete account error:', error);
    next(error);
  }
};

// Get user statistics
const getUserStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user with related data
    const userWithStats = await User.aggregate([
      {
        $match: { _id: userId }
      },
      {
        $lookup: {
          from: 'videos',
          localField: '_id',
          foreignField: 'user',
          as: 'videos'
        }
      },
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: 'user',
          as: 'posts'
        }
      },
      {
        $lookup: {
          from: 'socialaccounts',
          localField: '_id',
          foreignField: 'user',
          as: 'socialAccounts'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          createdAt: 1,
          totalVideos: { $size: '$videos' },
          totalPosts: { $size: '$posts' },
          connectedAccounts: { $size: '$socialAccounts' },
          totalViews: {
            $sum: '$posts.analytics.views'
          },
          totalLikes: {
            $sum: '$posts.analytics.likes'
          }
        }
      }
    ]);

    if (!userWithStats.length) {
      return sendNotFound(res, 'User not found');
    }

    const stats = userWithStats[0];

    sendSuccess(res, 'User statistics retrieved', { stats });
  } catch (error) {
    logger.error('Get user stats error:', error);
    next(error);
  }
};

// Admin function: Get all users (with pagination)
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();
    const meta = getPaginationMeta(page, limit, total);

    sendSuccess(res, 'Users retrieved successfully', { users }, meta);
  } catch (error) {
    logger.error('Get all users error:', error);
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updatePreferences,
  uploadProfilePicture,
  deleteAccount,
  getUserStats,
  getAllUsers
};