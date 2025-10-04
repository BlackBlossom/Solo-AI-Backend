const Post = require('../models/Post');
const Video = require('../models/Video');
const SocialAccount = require('../models/SocialAccount');
const bundleSocialService = require('../services/bundleSocialService');
const emailService = require('../services/emailService');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendNotFound,
  getPaginationMeta 
} = require('../utils/response');
const logger = require('../utils/logger');

// NOTE: createPost and schedulePost functions have been moved to newPostController.js 
// with improved Bundle.social integration and proper error handling

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
            const bundlePost = await bundleSocialService.getPost(post.bundlePostId);
            // Convert Bundle.social status to lowercase for our model
            post.bundleStatus = bundlePost.status ? bundlePost.status.toLowerCase() : post.bundleStatus;
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

    // Sync with Bundle.social if post has Bundle ID
    if (post.bundlePostId) {
      try {
        const bundlePost = await bundleSocialService.getPost(post.bundlePostId);
        
        // Update post status and details from Bundle.social
        let wasUpdated = false;
        
        // Update status
        const newStatus = bundlePost.status.toLowerCase();
        if (post.bundleStatus !== newStatus) {
          post.bundleStatus = newStatus;
          wasUpdated = true;
        }

        // Update published date if post is now posted
        if (bundlePost.status === 'POSTED' && bundlePost.postedDate && !post.publishedAt) {
          post.publishedAt = new Date(bundlePost.postedDate);
          wasUpdated = true;
        }

        // Update individual platform statuses based on Bundle.social status
        if (bundlePost.status === 'POSTED') {
          post.platforms.forEach(platform => {
            if (platform.status !== 'published') {
              platform.status = 'published';
              platform.publishedAt = post.publishedAt || new Date(bundlePost.postedDate);
              // Set platform post ID if available in external data
              if (bundlePost.externalData && bundlePost.externalData[platform.name.toUpperCase()]) {
                platform.postId = bundlePost.externalData[platform.name.toUpperCase()].id;
              }
              wasUpdated = true;
            }
          });
        } else if (bundlePost.status === 'ERROR') {
          post.platforms.forEach(platform => {
            if (platform.status !== 'failed') {
              platform.status = 'failed';
              // Set platform-specific error message if available
              if (bundlePost.errors && bundlePost.errors[platform.name.toUpperCase()]) {
                platform.errorMessage = bundlePost.errors[platform.name.toUpperCase()];
              }
              wasUpdated = true;
            }
          });
        } else if (bundlePost.status === 'SCHEDULED') {
          post.platforms.forEach(platform => {
            if (platform.status !== 'scheduled') {
              platform.status = 'scheduled';
              wasUpdated = true;
            }
          });
        }

        // Update error information
        if (bundlePost.error && post.bundleError !== bundlePost.error) {
          post.bundleError = bundlePost.error;
          wasUpdated = true;
        }

        // Update platform-specific errors
        if (bundlePost.errors) {
          if (!post.bundleErrors) {
            post.bundleErrors = new Map();
          }
          
          for (const [platform, error] of Object.entries(bundlePost.errors)) {
            if (post.bundleErrors.get(platform) !== error) {
              post.bundleErrors.set(platform, error);
              wasUpdated = true;
            }
          }
        }

        // Update external data (platform post IDs and permalinks)
        if (bundlePost.externalData) {
          if (!post.bundleExternalData) {
            post.bundleExternalData = new Map();
          }
          
          for (const [platform, data] of Object.entries(bundlePost.externalData)) {
            const currentData = post.bundleExternalData.get(platform);
            if (!currentData || currentData.id !== data.id || currentData.permalink !== data.permalink) {
              post.bundleExternalData.set(platform, {
                id: data.id,
                permalink: data.permalink
              });
              wasUpdated = true;
            }
          }
        }
        
        // Get latest analytics
        try {
          const analytics = await bundleSocialService.getPostAnalytics(post.bundlePostId);
          post.analytics = analytics;
          post.analytics.lastUpdated = new Date();
          wasUpdated = true;
        } catch (analyticsError) {
          logger.warn('Failed to fetch post analytics:', analyticsError.message);
        }
        
        if (wasUpdated) {
          await post.save();
          logger.info('Post synced with Bundle.social:', { 
            postId: post._id, 
            bundlePostId: post.bundlePostId,
            status: post.bundleStatus
          });
        }
        
      } catch (bundleError) {
        logger.warn('Failed to sync with Bundle.social:', { 
          postId: post._id, 
          bundlePostId: post.bundlePostId,
          error: bundleError.message 
        });
        // Continue with local data if Bundle.social sync fails
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
    if (post.bundleStatus === 'posted') {
      return sendError(res, 400, 'Cannot update published post');
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
        await bundleSocialService.updatePost(post.bundlePostId, {
          title: post.caption.substring(0, 50),
          postDate: post.scheduledFor ? post.scheduledFor.toISOString() : undefined,
          // Bundle.social may not support all update operations
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
        await bundleSocialService.deletePost(post.bundlePostId);
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

    if (post.bundleStatus === 'posted') {
      return sendError(res, 400, 'Post is already published');
    }

    // Update post status to published in Bundle.social
    let publishResult = null;
    if (post.bundlePostId) {
      try {
        publishResult = await bundleSocialService.updatePost(post.bundlePostId, {
          status: 'PUBLISHED'
        });
        logger.info('Post updated to published in Bundle.social:', { postId: post._id });
      } catch (bundleError) {
        logger.warn('Failed to update post status in Bundle.social:', bundleError.message);
      }
    }

    // Update local post status
    post.publishedAt = new Date();
    post.bundleStatus = 'published'; // Already lowercase
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
        const freshAnalytics = await bundleSocialService.getPostAnalytics(post.bundlePostId);
        
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

// Sync post status with Bundle.social
const syncPostStatus = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!post) {
      return sendNotFound(res, 'Post not found');
    }

    if (!post.bundlePostId) {
      return sendError(res, 400, 'Post is not linked to Bundle.social');
    }

    const bundlePost = await bundleSocialService.getPost(post.bundlePostId);
    
    // Store old status for comparison
    const oldStatus = post.bundleStatus;
    let wasUpdated = false;
    
    // Update status
    const newStatus = bundlePost.status.toLowerCase();
    if (post.bundleStatus !== newStatus) {
      post.bundleStatus = newStatus;
      wasUpdated = true;
    }

    // Update published date if post is now posted
    if (bundlePost.status === 'POSTED' && bundlePost.postedDate && !post.publishedAt) {
      post.publishedAt = new Date(bundlePost.postedDate);
      wasUpdated = true;
    }

    // Update individual platform statuses based on Bundle.social status
    if (bundlePost.status === 'POSTED') {
      post.platforms.forEach(platform => {
        if (platform.status !== 'published') {
          platform.status = 'published';
          platform.publishedAt = post.publishedAt || new Date(bundlePost.postedDate);
          // Set platform post ID if available in external data
          if (bundlePost.externalData && bundlePost.externalData[platform.name.toUpperCase()]) {
            platform.postId = bundlePost.externalData[platform.name.toUpperCase()].id;
          }
          wasUpdated = true;
        }
      });
    } else if (bundlePost.status === 'ERROR') {
      post.platforms.forEach(platform => {
        if (platform.status !== 'failed') {
          platform.status = 'failed';
          // Set platform-specific error message if available
          if (bundlePost.errors && bundlePost.errors[platform.name.toUpperCase()]) {
            platform.errorMessage = bundlePost.errors[platform.name.toUpperCase()];
          }
          wasUpdated = true;
        }
      });
    } else if (bundlePost.status === 'SCHEDULED') {
      post.platforms.forEach(platform => {
        if (platform.status !== 'scheduled') {
          platform.status = 'scheduled';
          wasUpdated = true;
        }
      });
    }

    // Update error information - normalize null/undefined comparison
    const normalizedBundleError = bundlePost.error || null;
    const normalizedPostError = post.bundleError || null;
    if (normalizedBundleError !== normalizedPostError) {
      post.bundleError = bundlePost.error;
      wasUpdated = true;
    }

    // Update platform-specific errors
    if (bundlePost.errors) {
      if (!post.bundleErrors) {
        post.bundleErrors = new Map();
      }
      
      for (const [platform, error] of Object.entries(bundlePost.errors)) {
        if (post.bundleErrors.get(platform) !== error) {
          post.bundleErrors.set(platform, error);
          wasUpdated = true;
        }
      }
    }

    // Update external data
    if (bundlePost.externalData) {
      if (!post.bundleExternalData) {
        post.bundleExternalData = new Map();
      }
      
      for (const [platform, data] of Object.entries(bundlePost.externalData)) {
        const currentData = post.bundleExternalData.get(platform);
        if (!currentData || currentData.id !== data.id || currentData.permalink !== data.permalink) {
          post.bundleExternalData.set(platform, {
            id: data.id,
            permalink: data.permalink
          });
          wasUpdated = true;
        }
      }
    }
    
    if (wasUpdated) {
      await post.save();
    }

    logger.info('Post status synced:', { 
      postId: post._id, 
      oldStatus, 
      newStatus: post.bundleStatus,
      wasUpdated 
    });

    sendSuccess(res, 'Post status synced successfully', {
      post: {
        id: post._id,
        bundleStatus: post.bundleStatus,
        publishedAt: post.publishedAt,
        bundleError: post.bundleError,
        bundleErrors: Object.fromEntries(post.bundleErrors || new Map()),
        bundleExternalData: Object.fromEntries(post.bundleExternalData || new Map())
      },
      changes: {
        statusChanged: oldStatus !== post.bundleStatus,
        oldStatus,
        newStatus: post.bundleStatus
      }
    });

  } catch (error) {
    logger.error('Error syncing post status:', error);
    next(error);
  }
};

module.exports = {
  getPosts,
  getUserPosts,
  getPost,
  updatePost,
  deletePost,
  publishPost,
  getPostAnalytics,
  getPostsSummary,
  syncPostStatus
};