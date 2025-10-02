const bundleSocialService = require('../services/bundleSocialService');
const SocialAccount = require('../models/SocialAccount');
const Post = require('../models/Post');
const { 
  sendSuccess, 
  sendNotFound 
} = require('../utils/response');
const logger = require('../utils/logger');

// Get account analytics - Direct Bundle.social integration
const getAccountAnalytics = async (req, res, next) => {
  try {
    const { socialAccountId } = req.params;

    // Verify the social account belongs to the user
    const socialAccount = await SocialAccount.findOne({
      user: req.user.id,
      bundleAccountId: socialAccountId
    });

    if (!socialAccount) {
      return sendNotFound(res, 'Social account not found or does not belong to you');
    }

    // Fetch analytics from Bundle.social
    const analytics = await bundleSocialService.getAccountAnalytics(socialAccountId);

    // Cache the analytics data (optional)
    socialAccount.lastAnalyticsUpdate = new Date();
    await socialAccount.save();

    logger.info('Account analytics retrieved:', {
      userId: req.user.id,
      socialAccountId,
      platform: socialAccount.platform
    });

    sendSuccess(res, 'Account analytics retrieved successfully', {
      socialAccount: {
        id: socialAccount._id,
        platform: socialAccount.platform,
        username: socialAccount.platformUsername
      },
      analytics
    });
  } catch (error) {
    logger.error('Get account analytics error:', error);
    next(error);
  }
};

// Get post analytics - Direct Bundle.social integration
const getPostAnalytics = async (req, res, next) => {
  try {
    const { postId } = req.params;

    // Find the post and verify it belongs to the user
    const post = await Post.findOne({
      user: req.user.id,
      bundlePostId: postId
    }).populate('video', 'title');

    if (!post) {
      return sendNotFound(res, 'Post not found or does not belong to you');
    }

    // Fetch analytics from Bundle.social using stored postId
    const analytics = await bundleSocialService.getPostAnalytics(
      req.user.bundleTeamId,
      postId
    );

    // Update local analytics cache
    post.analytics = {
      ...analytics,
      lastUpdated: new Date()
    };
    await post.save();

    logger.info('Post analytics retrieved:', {
      userId: req.user.id,
      postId,
      bundlePostId: post.bundlePostId
    });

    sendSuccess(res, 'Post analytics retrieved successfully', {
      post: {
        id: post._id,
        caption: post.caption,
        publishedAt: post.publishedAt,
        platforms: post.platforms,
        video: post.video
      },
      analytics
    });
  } catch (error) {
    logger.error('Get post analytics error:', error);
    next(error);
  }
};

// Get user's overall analytics summary
const getUserAnalyticsSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Get team analytics from Bundle.social
    const teamAnalytics = await bundleSocialService.getTeamAnalytics(
      req.user.bundleTeamId,
      { startDate, endDate }
    );

    // Get local post analytics
    const dateFilter = {
      user: req.user.id,
      publishedAt: { $exists: true }
    };

    if (startDate || endDate) {
      dateFilter.publishedAt = {};
      if (startDate) dateFilter.publishedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.publishedAt.$lte = new Date(endDate);
    }

    const localAnalytics = await Post.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalPosts: { $sum: 1 },
          totalViews: { $sum: '$analytics.views' },
          totalLikes: { $sum: '$analytics.likes' },
          totalComments: { $sum: '$analytics.comments' },
          totalShares: { $sum: '$analytics.shares' },
          platformBreakdown: {
            $push: '$platforms.name'
          }
        }
      }
    ]);

    const summary = {
      teamAnalytics,
      localAnalytics: localAnalytics[0] || {
        totalPosts: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        platformBreakdown: []
      }
    };

    sendSuccess(res, 'User analytics summary retrieved', { summary });
  } catch (error) {
    logger.error('Get user analytics summary error:', error);
    next(error);
  }
};

module.exports = {
  getAccountAnalytics,
  getPostAnalytics,
  getUserAnalyticsSummary
};