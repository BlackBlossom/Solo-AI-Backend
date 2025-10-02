const Post = require('../models/Post');
const Video = require('../models/Video');
const SocialAccount = require('../models/SocialAccount');
const bundleSocialService = require('../services/bundleSocialService');
const emailService = require('../services/emailService');
const { 
  sendSuccess, 
  sendCreated, 
  sendBadRequest, 
  sendNotFound,
  getPaginationMeta 
} = require('../utils/response');
const logger = require('../utils/logger');

// Create new post
const createPost = async (req, res, next) => {
  try {
    const { videoId, caption, hashtags, platforms, scheduledFor, settings } = req.body;

    // Verify video exists and belongs to user
    const video = await Video.findOne({
      _id: videoId,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Verify all selected platforms are connected
    const connectedAccounts = await SocialAccount.find({
      user: req.user.id,
      platform: { $in: platforms.map(p => p.name) },
      isConnected: true
    });

    const connectedPlatforms = connectedAccounts.map(acc => acc.platform);
    const requestedPlatforms = platforms.map(p => p.name);
    const missingPlatforms = requestedPlatforms.filter(p => !connectedPlatforms.includes(p));

    if (missingPlatforms.length > 0) {
      return sendBadRequest(res, `Not connected to: ${missingPlatforms.join(', ')}`);
    }

    // Create post record
    const post = await Post.create({
      user: req.user.id,
      video: videoId,
      caption,
      hashtags: hashtags || [],
      platforms: platforms.map(p => ({
        name: p.name,
        accountId: connectedAccounts.find(acc => acc.platform === p.name).bundleAccountId,
        status: 'pending'
      })),
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      settings: settings || {}
    });

    // Create post in Bundle.social
    try {
      // Get the Bundle.social platform types (uppercase)
      const socialAccountTypes = platforms.map(p => p.name.toUpperCase());
      
      // Prepare platform-specific data
      const platformData = {};
      platforms.forEach(platform => {
        const platformName = platform.name.toUpperCase();
        const fullCaption = caption + (hashtags?.length ? ' ' + hashtags.map(h => `#${h}`).join(' ') : '');
        
        // Create platform-specific data based on Bundle.social API structure
        switch (platformName) {
          case 'INSTAGRAM':
            platformData[platformName] = {
              type: video.duration > 60 ? 'REEL' : 'POST', // Assume reels for longer videos
              text: fullCaption,
              uploadIds: video.bundleUploadId ? [video.bundleUploadId] : []
            };
            break;
          case 'TIKTOK':
            platformData[platformName] = {
              text: fullCaption,
              uploadIds: video.bundleUploadId ? [video.bundleUploadId] : [],
              privacy: 'PUBLIC_TO_EVERYONE',
              isBrandContent: false,
              disableComments: false,
              disableDuet: false,
              disableStitch: false
            };
            break;
          case 'YOUTUBE':
            platformData[platformName] = {
              type: video.duration <= 60 ? 'SHORT' : 'VIDEO',
              uploadIds: video.bundleUploadId ? [video.bundleUploadId] : [],
              text: video.title || caption.substring(0, 100), // YouTube title
              description: caption,
              privacy: 'PUBLIC',
              madeForKids: false
            };
            break;
          case 'FACEBOOK':
            platformData[platformName] = {
              type: video.duration > 60 ? 'REEL' : 'POST',
              text: fullCaption,
              uploadIds: video.bundleUploadId ? [video.bundleUploadId] : []
            };
            break;
          case 'TWITTER':
            platformData[platformName] = {
              text: fullCaption.substring(0, 280), // Twitter character limit
              uploadIds: video.bundleUploadId ? [video.bundleUploadId] : []
            };
            break;
          case 'LINKEDIN':
            platformData[platformName] = {
              text: fullCaption,
              uploadIds: video.bundleUploadId ? [video.bundleUploadId] : [],
              privacy: 'PUBLIC',
              hideFromFeed: false,
              disableReshare: false
            };
            break;
          default:
            platformData[platformName] = {
              text: fullCaption,
              uploadIds: video.bundleUploadId ? [video.bundleUploadId] : []
            };
        }
      });

      const bundlePost = await bundleSocialService.createPost({
        teamId: req.user.bundleTeamId,
        title: video.title || caption.substring(0, 50),
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        status: scheduledFor ? 'SCHEDULED' : 'DRAFT',
        socialAccountTypes,
        data: platformData
      });

      post.bundlePostId = bundlePost.id;
      post.bundleStatus = bundlePost.status;
      await post.save();
      
      logger.info('Post created in Bundle.social successfully:', { 
        postId: post._id, 
        bundlePostId: bundlePost.id 
      });
    } catch (bundleError) {
      logger.warn('Bundle.social post creation failed:', bundleError.message);
      // Continue with local post creation even if Bundle.social fails
    }

    // If not scheduled, attempt to publish immediately
    if (!scheduledFor && settings?.autoPublish) {
      try {
        await bundleSocialService.publishPost(req.user.bundleTeamId, post.bundlePostId);
        
        post.publishedAt = new Date();
        post.bundleStatus = 'published';
        post.platforms.forEach(platform => {
          platform.status = 'published';
          platform.publishedAt = new Date();
        });
        await post.save();

        // Send notification email
        emailService.sendPostPublishedNotification(req.user, post).catch(err => {
          logger.warn('Failed to send post notification:', err.message);
        });
      } catch (publishError) {
        logger.warn('Failed to publish post immediately:', publishError.message);
      }
    }

    logger.info('Post created successfully:', { postId: post._id, userId: req.user.id });

    sendCreated(res, 'Post created successfully', { post });
  } catch (error) {
    logger.error('Create post error:', error);
    next(error);
  }
};

// Schedule post - following Bundle.social integration pattern
const schedulePost = async (req, res, next) => {
  try {
    const { videoId, caption, hashtags, platforms, scheduledFor, settings } = req.body;

    if (!scheduledFor) {
      return sendBadRequest(res, 'scheduledFor is required for scheduling posts');
    }

    // Verify video exists and belongs to user
    const video = await Video.findOne({
      _id: videoId,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Verify all selected platforms are connected
    const connectedAccounts = await SocialAccount.find({
      user: req.user.id,
      platform: { $in: platforms.map(p => p.name) },
      isConnected: true
    });

    const connectedPlatforms = connectedAccounts.map(acc => acc.platform);
    const requestedPlatforms = platforms.map(p => p.name);
    const missingPlatforms = requestedPlatforms.filter(p => !connectedPlatforms.includes(p));

    if (missingPlatforms.length > 0) {
      return sendBadRequest(res, `Not connected to: ${missingPlatforms.join(', ')}`);
    }

    // Create post record
    const post = await Post.create({
      user: req.user.id,
      video: videoId,
      caption,
      hashtags: hashtags || [],
      platforms: platforms.map(p => ({
        name: p.name,
        accountId: connectedAccounts.find(acc => acc.platform === p.name).bundleAccountId,
        status: 'scheduled'
      })),
      scheduledFor: new Date(scheduledFor),
      settings: settings || {}
    });

    // Schedule post in Bundle.social
    try {
      const bundlePost = await bundleSocialService.createPost(req.user.bundleTeamId, {
        mediaId: video.bundleUploadId,
        caption: caption + (hashtags?.length ? ' ' + hashtags.map(h => `#${h}`).join(' ') : ''),
        platforms: platforms.map(p => ({
          name: p.name,
          accountId: connectedAccounts.find(acc => acc.platform === p.name).bundleAccountId
        })),
        scheduledFor,
        settings
      });

      post.bundlePostId = bundlePost.id;
      post.bundleStatus = 'scheduled';
      await post.save();
    } catch (bundleError) {
      logger.warn('Bundle.social post scheduling failed:', bundleError.message);
    }

    logger.info('Post scheduled successfully:', { postId: post._id, userId: req.user.id, scheduledFor });

    sendCreated(res, 'Post scheduled successfully', { post });
  } catch (error) {
    logger.error('Schedule post error:', error);
    next(error);
  }
};

// Get user's posts - following specification pattern
const getUserPosts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    // Verify user access (users can only access their own posts or admin access)
    if (id !== req.user.id && req.user.role !== 'admin') {
      return sendNotFound(res, 'Access denied');
    }

    const filter = { user: id };
    if (status) {
      filter.bundleStatus = status;
    }

    const posts = await Post.find(filter)
      .populate('video', 'title thumbnailPath duration')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(filter);
    const meta = getPaginationMeta(page, limit, total);

    // Optionally fetch real-time status from Bundle.social
    if (req.query.refresh === 'true') {
      for (let post of posts) {
        if (post.bundlePostId) {
          try {
            const bundlePost = await bundleSocialService.getPost(req.user.bundleTeamId, post.bundlePostId);
            post.bundleStatus = bundlePost.status;
            if (bundlePost.publishedAt && !post.publishedAt) {
              post.publishedAt = new Date(bundlePost.publishedAt);
            }
            await post.save();
          } catch (bundleError) {
            logger.warn('Failed to refresh post status:', bundleError.message);
          }
        }
      }
    }

    sendSuccess(res, 'User posts retrieved successfully', { posts }, meta);
  } catch (error) {
    logger.error('Get user posts error:', error);
    next(error);
  }
};

// Get user's posts (legacy method for backward compatibility)
const getPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = { user: req.user.id };
    if (status) {
      filter.bundleStatus = status;
    }

    const posts = await Post.find(filter)
      .populate('video', 'title thumbnailPath duration')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(filter);
    const meta = getPaginationMeta(page, limit, total);

    sendSuccess(res, 'Posts retrieved successfully', { posts }, meta);
  } catch (error) {
    logger.error('Get posts error:', error);
    next(error);
  }
};

// Get single post
const getPost = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('video', 'title description thumbnailPath duration fileSize');

    if (!post) {
      return sendNotFound(res, 'Post not found');
    }

    // Get latest analytics if available
    if (post.bundlePostId) {
      try {
        const analytics = await bundleSocialService.getPostAnalytics(
          req.user.bundleTeamId,
          post.bundlePostId
        );
        
        post.analytics = analytics;
        post.analytics.lastUpdated = new Date();
        await post.save();
      } catch (analyticsError) {
        logger.warn('Failed to fetch post analytics:', analyticsError.message);
      }
    }

    sendSuccess(res, 'Post retrieved successfully', { post });
  } catch (error) {
    logger.error('Get post error:', error);
    next(error);
  }
};

// Update post
const updatePost = async (req, res, next) => {
  try {
    const { caption, hashtags, scheduledFor, settings } = req.body;

    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!post) {
      return sendNotFound(res, 'Post not found');
    }

    // Check if post is already published
    if (post.bundleStatus === 'published') {
      return sendBadRequest(res, 'Cannot update published post');
    }

    // Update post data
    const updateData = {};
    if (caption !== undefined) updateData.caption = caption;
    if (hashtags !== undefined) updateData.hashtags = hashtags;
    if (scheduledFor !== undefined) updateData.scheduledFor = new Date(scheduledFor);
    if (settings !== undefined) updateData.settings = { ...post.settings, ...settings };

    Object.assign(post, updateData);
    await post.save();

    // Update in Bundle.social
    if (post.bundlePostId) {
      try {
        await bundleSocialService.updatePost(req.user.bundleTeamId, post.bundlePostId, {
          caption: post.caption + (post.hashtags?.length ? ' ' + post.hashtags.map(h => `#${h}`).join(' ') : ''),
          scheduledFor: post.scheduledFor,
          settings: post.settings
        });
      } catch (bundleError) {
        logger.warn('Bundle.social post update failed:', bundleError.message);
      }
    }

    logger.info('Post updated successfully:', { postId: post._id, userId: req.user.id });

    sendSuccess(res, 'Post updated successfully', { post });
  } catch (error) {
    logger.error('Update post error:', error);
    next(error);
  }
};

// Delete post
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!post) {
      return sendNotFound(res, 'Post not found');
    }

    // Delete from Bundle.social
    if (post.bundlePostId) {
      try {
        await bundleSocialService.deletePost(req.user.bundleTeamId, post.bundlePostId);
      } catch (bundleError) {
        logger.warn('Failed to delete from Bundle.social:', bundleError.message);
      }
    }

    await Post.findByIdAndDelete(req.params.id);

    logger.info('Post deleted successfully:', { postId: req.params.id, userId: req.user.id });

    sendSuccess(res, 'Post deleted successfully');
  } catch (error) {
    logger.error('Delete post error:', error);
    next(error);
  }
};

// Publish post immediately
const publishPost = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!post) {
      return sendNotFound(res, 'Post not found');
    }

    if (post.bundleStatus === 'published') {
      return sendBadRequest(res, 'Post is already published');
    }

    // Publish via Bundle.social
    const publishResult = await bundleSocialService.publishPost(
      req.user.bundleTeamId,
      post.bundlePostId
    );

    // Update post status
    post.publishedAt = new Date();
    post.bundleStatus = 'published';
    post.platforms.forEach(platform => {
      platform.status = 'published';
      platform.publishedAt = new Date();
    });

    await post.save();

    // Send notification email
    emailService.sendPostPublishedNotification(req.user, post).catch(err => {
      logger.warn('Failed to send post notification:', err.message);
    });

    logger.info('Post published successfully:', { postId: post._id, userId: req.user.id });

    sendSuccess(res, 'Post published successfully', {
      post,
      publishResult
    });
  } catch (error) {
    logger.error('Publish post error:', error);
    next(error);
  }
};

// Get post analytics
const getPostAnalytics = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('video', 'title');

    if (!post) {
      return sendNotFound(res, 'Post not found');
    }

    let analytics = post.analytics || {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0
    };

    // Get latest analytics from Bundle.social
    if (post.bundlePostId) {
      try {
        const freshAnalytics = await bundleSocialService.getPostAnalytics(
          req.user.bundleTeamId,
          post.bundlePostId
        );
        
        analytics = freshAnalytics;
        
        // Update stored analytics
        post.analytics = analytics;
        post.analytics.lastUpdated = new Date();
        await post.save();
      } catch (analyticsError) {
        logger.warn('Failed to fetch fresh analytics:', analyticsError.message);
      }
    }

    sendSuccess(res, 'Post analytics retrieved', {
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

// Get user's post analytics summary
const getPostsSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {
      user: req.user.id,
      publishedAt: { $exists: true }
    };

    if (startDate || endDate) {
      dateFilter.publishedAt = {};
      if (startDate) dateFilter.publishedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.publishedAt.$lte = new Date(endDate);
    }

    const summary = await Post.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalPosts: { $sum: 1 },
          totalViews: { $sum: '$analytics.views' },
          totalLikes: { $sum: '$analytics.likes' },
          totalComments: { $sum: '$analytics.comments' },
          totalShares: { $sum: '$analytics.shares' },
          platforms: { $push: '$platforms.name' }
        }
      },
      {
        $project: {
          _id: 0,
          totalPosts: 1,
          totalViews: 1,
          totalLikes: 1,
          totalComments: 1,
          totalShares: 1,
          totalEngagements: { 
            $add: ['$totalLikes', '$totalComments', '$totalShares'] 
          },
          platformBreakdown: {
            $reduce: {
              input: '$platforms',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  { 
                    '$$this': { 
                      $add: [{ $ifNull: ['$$value.$$this', 0] }, 1] 
                    } 
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    const result = summary[0] || {
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalEngagements: 0,
      platformBreakdown: {}
    };

    sendSuccess(res, 'Posts summary retrieved', { summary: result });
  } catch (error) {
    logger.error('Get posts summary error:', error);
    next(error);
  }
};

module.exports = {
  createPost,
  schedulePost,
  getPosts,
  getUserPosts,
  getPost,
  updatePost,
  deletePost,
  publishPost,
  getPostAnalytics,
  getPostsSummary
};