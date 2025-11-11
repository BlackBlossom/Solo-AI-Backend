const { sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils/response');
const Video = require('../models/Video');
const Post = require('../models/Post');
const SocialAccount = require('../models/SocialAccount');
const bundleSocialService = require('../services/bundleSocialService');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// Create immediate post (publish right now)
const createImmediatePost = async (req, res, next) => {
  try {
    const { videoId, caption, hashtags, platforms, settings } = req.body;

    // Reject scheduledFor parameter for immediate posts
    if (req.body.scheduledFor) {
      return sendError(res, 400, 'scheduledFor parameter is not allowed for immediate posts. Use /api/v1/posts/schedule for scheduled posts.');
    }

    // Declare variables at function scope for error handling
    let socialAccountTypes;
    let platformData;

    // Verify video exists and belongs to user
    const video = await Video.findOne({
      _id: videoId,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Verify video has been uploaded to Bundle.social
    if (!video.bundleUploadId) {
      return sendError(res, 400, 'Video must be uploaded to Bundle.social before creating posts');
    }

    // Verify all selected platforms are connected
    const connectedAccounts = await SocialAccount.find({
      user: req.user.id,
      platform: { $in: platforms.map(p => p.name.toLowerCase()) },
      isConnected: true
    });

    if (connectedAccounts.length !== platforms.length) {
      const missingPlatforms = platforms.filter(p => 
        !connectedAccounts.find(acc => acc.platform === p.name.toLowerCase())
      );
      return sendError(res, 400, `Please connect your ${missingPlatforms.map(p => p.name).join(', ')} account(s) first`);
    }

    // Create post record in database
    const post = await Post.create({
      user: req.user.id,
      video: videoId,
      thumbnailUrl: video.thumbnailUrl, // Cache video thumbnail for quick access
      caption,
      hashtags: hashtags || [],
      platforms: platforms.map(p => ({
        name: p.name.toLowerCase(),
        accountId: connectedAccounts.find(acc => acc.platform === p.name.toLowerCase()).bundleAccountId,
        status: 'pending'
      })),
      settings: settings || {}
    });

    // Create immediate post in Bundle.social
    try {
      // Get the Bundle.social platform types (uppercase)
      socialAccountTypes = platforms.map(p => p.name.toUpperCase());
      
      // Prepare platform-specific data according to Bundle.social format
      platformData = {};
      platforms.forEach(platform => {
        const platformName = platform.name.toUpperCase();
        const fullCaption = caption + (hashtags?.length ? ' ' + hashtags.map(h => `#${h}`).join(' ') : '');
        
        switch (platformName) {
          case 'INSTAGRAM':
            platformData[platformName] = {
              type: video.duration > 60 ? 'REEL' : 'POST',
              text: fullCaption,
              uploadIds: [video.bundleUploadId],
              thumbnailOffset: 0,
              shareToFeed: true
            };
            break;
          case 'TIKTOK':
            platformData[platformName] = {
              text: fullCaption,
              uploadIds: [video.bundleUploadId],
              privacy: 'PUBLIC_TO_EVERYONE',
              isBrandContent: false,
              disableComments: false,
              disableDuet: false,
              disableStitch: false
            };
            break;
          case 'YOUTUBE':
            // Use user-specified type from platform settings, or default based on duration
            const youtubePlatform = platforms.find(p => p.name.toUpperCase() === 'YOUTUBE');
            const youtubeType = youtubePlatform?.type || (video.duration <= 60 ? 'SHORT' : 'VIDEO');
            
            platformData[platformName] = {
              type: youtubeType.toUpperCase(),
              uploadIds: [video.bundleUploadId],
              text: video.title || caption.substring(0, 100),
              description: caption,
              privacy: 'PUBLIC',
              madeForKids: false
            };
            break;
          case 'FACEBOOK':
            platformData[platformName] = {
              type: video.duration > 60 ? 'REEL' : 'POST',
              text: fullCaption,
              uploadIds: [video.bundleUploadId]
            };
            break;
          case 'TWITTER':
            platformData[platformName] = {
              text: fullCaption.substring(0, 280),
              uploadIds: [video.bundleUploadId]
            };
            break;
          case 'LINKEDIN':
            platformData[platformName] = {
              text: fullCaption,
              uploadIds: [video.bundleUploadId],
              privacy: 'PUBLIC',
              hideFromFeed: false,
              disableReshare: false
            };
            break;
          default:
            platformData[platformName] = {
              text: fullCaption,
              uploadIds: [video.bundleUploadId]
            };
        }
      });

      logger.info('Creating immediate post in Bundle.social:', {
        teamId: req.user.bundleTeamId,
        videoId: video._id,
        bundleUploadId: video.bundleUploadId,
        platforms: socialAccountTypes
      });

      const bundlePostParams = {
        teamId: req.user.bundleTeamId,
        title: video.title || caption.substring(0, 50),
        socialAccountTypes,
        data: platformData
      };

      const bundlePost = await bundleSocialService.createImmediatePost(bundlePostParams);

      // Update post with Bundle.social details
      post.bundlePostId = bundlePost.id;
      post.bundleStatus = bundlePost.status.toLowerCase(); // Use actual Bundle.social status
      
      // Set publishedAt only if the post is actually posted
      if (bundlePost.status === 'POSTED') {
        post.publishedAt = bundlePost.postedDate ? new Date(bundlePost.postedDate) : new Date();
        
        // Update platform statuses to published
        post.platforms.forEach(platform => {
          platform.status = 'published';
          platform.publishedAt = post.publishedAt;
          // Set platform post ID if available in external data
          if (bundlePost.externalData && bundlePost.externalData[platform.name.toUpperCase()]) {
            platform.postId = bundlePost.externalData[platform.name.toUpperCase()].id;
          }
        });
      } else {
        // Update platform statuses based on Bundle.social status
        const platformStatus = bundlePost.status === 'SCHEDULED' ? 'scheduled' : 
                             bundlePost.status === 'ERROR' ? 'failed' : 'pending';
        post.platforms.forEach(platform => {
          platform.status = platformStatus;
          if (bundlePost.errors && bundlePost.errors[platform.name.toUpperCase()]) {
            platform.errorMessage = bundlePost.errors[platform.name.toUpperCase()];
          }
        });
      }
      
      await post.save();

      // Add post ID to user's posts array
      const User = require('../models/User');
      await User.findByIdAndUpdate(
        req.user.id,
        { $addToSet: { posts: post._id } }, // $addToSet prevents duplicates
        { new: true }
      );

      // Send notification email
      emailService.sendPostPublishedNotification(req.user, post).catch(err => {
        logger.warn('Failed to send post notification:', err.message);
      });

      logger.info('Immediate post published successfully:', { 
        postId: post._id, 
        bundlePostId: bundlePost.id,
        userId: req.user.id,
        addedToUserProfile: true
      });

      sendSuccess(res, 'Post published immediately', {
        postId: post._id,
        bundlePostId: bundlePost.id,
        bundleStatus: post.bundleStatus,
        publishedAt: post.publishedAt,
        platforms: post.platforms
      });

    } catch (bundleError) {
      logger.error('Bundle.social immediate post creation failed:', {
        errorMessage: bundleError.message,
        bundleTeamId: req.user.bundleTeamId,
        videoUploadId: video.bundleUploadId,
        socialAccountTypes,
        postId: post._id,
        userId: req.user.id,
        videoId: video._id,
        platformData: JSON.stringify(platformData, null, 2)
      });

      // Delete the post record since Bundle.social creation failed
      await Post.findByIdAndDelete(post._id);

      const errorDetails = bundleError.response?.data?.message || bundleError.message;
      return next(new Error(`Bundle.social API Error: ${errorDetails}`));
    }

  } catch (error) {
    logger.error('Create immediate post error:', error);
    return next(error);
  }
};

// Create scheduled post for future publishing
const createScheduledPost = async (req, res, next) => {
  try {
    const { videoId, caption, hashtags, platforms, scheduledFor, settings } = req.body;

    // Validate scheduled date
    if (!scheduledFor) {
      return sendValidationError(res, 'Scheduled date is required for scheduled posts');
    }

    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      return sendValidationError(res, 'Scheduled date must be in the future');
    }

    // Declare variables at function scope for error handling
    let socialAccountTypes;
    let platformData;

    // Verify video exists and belongs to user
    const video = await Video.findOne({
      _id: videoId,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Verify video has been uploaded to Bundle.social
    if (!video.bundleUploadId) {
      return sendError(res, 400, 'Video must be uploaded to Bundle.social before creating posts');
    }

    // Verify all selected platforms are connected
    const connectedAccounts = await SocialAccount.find({
      user: req.user.id,
      platform: { $in: platforms.map(p => p.name.toLowerCase()) },
      isConnected: true
    });

    if (connectedAccounts.length !== platforms.length) {
      const missingPlatforms = platforms.filter(p => 
        !connectedAccounts.find(acc => acc.platform === p.name.toLowerCase())
      );
      return sendError(res, 400, `Please connect your ${missingPlatforms.map(p => p.name).join(', ')} account(s) first`);
    }

    // Create post record in database
    const post = await Post.create({
      user: req.user.id,
      video: videoId,
      thumbnailUrl: video.thumbnailUrl, // Cache video thumbnail for quick access
      caption,
      hashtags: hashtags || [],
      platforms: platforms.map(p => ({
        name: p.name.toLowerCase(),
        accountId: connectedAccounts.find(acc => acc.platform === p.name.toLowerCase()).bundleAccountId,
        status: 'scheduled'
      })),
      scheduledFor: scheduledDate,
      settings: settings || {}
    });

    // Create scheduled post in Bundle.social
    try {
      // Get the Bundle.social platform types (uppercase)
      socialAccountTypes = platforms.map(p => p.name.toUpperCase());
      
      // Prepare platform-specific data according to Bundle.social format
      platformData = {};
      platforms.forEach(platform => {
        const platformName = platform.name.toUpperCase();
        const fullCaption = caption + (hashtags?.length ? ' ' + hashtags.map(h => `#${h}`).join(' ') : '');
        
        switch (platformName) {
          case 'INSTAGRAM':
            platformData[platformName] = {
              type: video.duration > 60 ? 'REEL' : 'POST',
              text: fullCaption,
              uploadIds: [video.bundleUploadId],
              thumbnailOffset: 0,
              shareToFeed: true
            };
            break;
          case 'TIKTOK':
            platformData[platformName] = {
              text: fullCaption,
              uploadIds: [video.bundleUploadId],
              privacy: 'PUBLIC_TO_EVERYONE',
              isBrandContent: false,
              disableComments: false,
              disableDuet: false,
              disableStitch: false
            };
            break;
          case 'YOUTUBE':
            // Use user-specified type from platform settings, or default based on duration
            const youtubePlatformScheduled = platforms.find(p => p.name.toUpperCase() === 'YOUTUBE');
            const youtubeTypeScheduled = youtubePlatformScheduled?.type || (video.duration <= 60 ? 'SHORT' : 'VIDEO');
            
            platformData[platformName] = {
              type: youtubeTypeScheduled.toUpperCase(),
              uploadIds: [video.bundleUploadId],
              text: video.title || caption.substring(0, 100),
              description: caption,
              privacy: 'PUBLIC',
              madeForKids: false
            };
            break;
          case 'FACEBOOK':
            platformData[platformName] = {
              type: video.duration > 60 ? 'REEL' : 'POST',
              text: fullCaption,
              uploadIds: [video.bundleUploadId]
            };
            break;
          case 'TWITTER':
            platformData[platformName] = {
              text: fullCaption.substring(0, 280),
              uploadIds: [video.bundleUploadId]
            };
            break;
          case 'LINKEDIN':
            platformData[platformName] = {
              text: fullCaption,
              uploadIds: [video.bundleUploadId],
              privacy: 'PUBLIC',
              hideFromFeed: false,
              disableReshare: false
            };
            break;
          default:
            platformData[platformName] = {
              text: fullCaption,
              uploadIds: [video.bundleUploadId]
            };
        }
      });

      logger.info('Creating scheduled post in Bundle.social:', {
        teamId: req.user.bundleTeamId,
        videoId: video._id,
        bundleUploadId: video.bundleUploadId,
        platforms: socialAccountTypes,
        scheduledFor: scheduledDate.toISOString()
      });

      const bundlePostParams = {
        teamId: req.user.bundleTeamId,
        title: video.title || caption.substring(0, 50),
        scheduledFor: scheduledDate.toISOString(),
        socialAccountTypes,
        data: platformData
      };

      const bundlePost = await bundleSocialService.createScheduledPost(bundlePostParams);

      // Update post with Bundle.social details
      post.bundlePostId = bundlePost.id;
      post.bundleStatus = bundlePost.status.toLowerCase(); // Use actual Bundle.social status
      
      // Set publishedAt if the post is already posted
      if (bundlePost.status === 'POSTED' && bundlePost.postedDate) {
        post.publishedAt = new Date(bundlePost.postedDate);
        
        // Update platform statuses to published
        post.platforms.forEach(platform => {
          platform.status = 'published';
          platform.publishedAt = post.publishedAt;
          // Set platform post ID if available in external data
          if (bundlePost.externalData && bundlePost.externalData[platform.name.toUpperCase()]) {
            platform.postId = bundlePost.externalData[platform.name.toUpperCase()].id;
          }
        });
      } else {
        // Update platform statuses based on Bundle.social status
        const platformStatus = bundlePost.status === 'SCHEDULED' ? 'scheduled' : 
                             bundlePost.status === 'ERROR' ? 'failed' : 'pending';  
        post.platforms.forEach(platform => {
          platform.status = platformStatus;
          if (bundlePost.errors && bundlePost.errors[platform.name.toUpperCase()]) {
            platform.errorMessage = bundlePost.errors[platform.name.toUpperCase()];
          }
        });
      }
      
      await post.save();

      // Add post ID to user's posts array
      const User = require('../models/User');
      await User.findByIdAndUpdate(
        req.user.id,
        { $addToSet: { posts: post._id } }, // $addToSet prevents duplicates
        { new: true }
      );

      logger.info('Scheduled post created successfully:', { 
        postId: post._id, 
        bundlePostId: bundlePost.id,
        scheduledFor: scheduledDate.toISOString(),
        userId: req.user.id,
        addedToUserProfile: true
      });

      sendSuccess(res, 'Post scheduled successfully', {
        postId: post._id,
        bundlePostId: bundlePost.id,
        bundleStatus: post.bundleStatus,
        scheduledFor: post.scheduledFor,
        platforms: post.platforms
      });

    } catch (bundleError) {
      logger.error('Bundle.social scheduled post creation failed:', {
        errorMessage: bundleError.message,
        bundleTeamId: req.user.bundleTeamId,
        videoUploadId: video.bundleUploadId,
        socialAccountTypes,
        postId: post._id,
        userId: req.user.id,
        videoId: video._id,
        scheduledFor: scheduledDate.toISOString(),
        platformData: JSON.stringify(platformData, null, 2)
      });

      // Delete the post record since Bundle.social creation failed
      await Post.findByIdAndDelete(post._id);

      const errorDetails = bundleError.response?.data?.message || bundleError.message;
      return next(new Error(`Bundle.social API Error: ${errorDetails}`));
    }

  } catch (error) {
    logger.error('Create scheduled post error:', error);
    return next(error);
  }
};

module.exports = {
  createImmediatePost,
  createScheduledPost
};