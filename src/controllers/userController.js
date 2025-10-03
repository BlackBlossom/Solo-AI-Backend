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
    const allowedFields = [
      'name',
      'dateOfBirth', 
      'gender', 
      'phoneNumber', 
      'preferences'
    ];
    const updateData = {};

    // Filter allowed fields
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    // Validate date of birth if provided
    if (updateData.dateOfBirth) {
      const dob = new Date(updateData.dateOfBirth);
      if (dob >= new Date()) {
        return sendBadRequest(res, 'Date of birth must be in the past');
      }
    }

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

    logger.info('Profile updated successfully:', { 
      userId: user._id, 
      updatedFields: Object.keys(updateData) 
    });

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

    // Get user with password and populate related data
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    // Verify password for email login type users
    if (user.loginType === 'email') {
      if (!password) {
        return sendBadRequest(res, 'Password is required for account deletion');
      }
      
      const isPasswordCorrect = await user.correctPassword(password, user.password);
      if (!isPasswordCorrect) {
        return sendBadRequest(res, 'Password is incorrect');
      }
    }

    const userId = user._id;
    const bundleTeamId = user.bundleTeamId;

    logger.info('Starting account deletion process:', { 
      userId, 
      bundleTeamId,
      loginType: user.loginType 
    });

    // Start deletion process with database transaction for data consistency
    const session = await User.startSession();
    
    try {
      await session.withTransaction(async () => {
        // 1. Get counts for logging before deletion
        const Video = require('../models/Video');
        const Post = require('../models/Post');
        const SocialAccount = require('../models/SocialAccount');
        
        const videoCount = await Video.countDocuments({ user: userId }).session(session);
        const postCount = await Post.countDocuments({ user: userId }).session(session);
        const socialAccountCount = await SocialAccount.countDocuments({ user: userId }).session(session);

        // 2. Delete all user's videos from database
        // Note: Bundle.social uploads will be deleted automatically when team is deleted
        await Video.deleteMany({ user: userId }).session(session);
        logger.info('Deleted user videos from database:', { userId, count: videoCount });

        // 3. Delete all user's posts from database  
        // Note: Bundle.social posts will be deleted automatically when team is deleted
        await Post.deleteMany({ user: userId }).session(session);
        logger.info('Deleted user posts from database:', { userId, count: postCount });

        // 4. Delete all social accounts from database
        // Note: Bundle.social social accounts will be disconnected automatically when team is deleted
        await SocialAccount.deleteMany({ user: userId }).session(session);
        logger.info('Deleted social accounts from database:', { userId, count: socialAccountCount });

        // 5. Delete the user
        await User.findByIdAndDelete(userId).session(session);
        logger.info('Deleted user record:', { userId });
      });

      // 6. Delete Bundle.social team (outside transaction as it's external API)
      // This will automatically delete all related data: uploads, posts, social accounts
      if (bundleTeamId) {
        try {
          const bundleSocialService = require('../services/bundleSocialService');
          await bundleSocialService.deleteTeam(bundleTeamId);
          logger.info('Deleted Bundle.social team and all related data:', { 
            bundleTeamId, 
            userId,
            note: 'This automatically deleted all uploads, posts, and social account connections'
          });
        } catch (error) {
          logger.error('Failed to delete Bundle.social team:', { 
            bundleTeamId, 
            userId, 
            error: error.message 
          });
          // Don't fail the entire operation if Bundle.social deletion fails
        }
      }

      logger.info('Account deletion completed successfully:', { userId });
      sendSuccess(res, 'Account and all related data deleted successfully');

    } catch (transactionError) {
      logger.error('Database transaction failed during account deletion:', {
        userId,
        error: transactionError.message
      });
      throw transactionError;
    } finally {
      await session.endSession();
    }

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