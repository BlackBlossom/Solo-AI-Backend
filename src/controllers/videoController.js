const Video = require('../models/Video');
const bundleSocialService = require('../services/bundleSocialService');
const aiService = require('../services/aiService');
const { 
  sendSuccess, 
  sendCreated, 
  sendBadRequest, 
  sendNotFound,
  getPaginationMeta 
} = require('../utils/response');
const { formatFileSize, formatDuration } = require('../utils/helpers');
const logger = require('../utils/logger');

// Upload video directly to Bundle.social (no local storage)
const uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendBadRequest(res, 'Please upload a video file');
    }

    const { title, description } = req.body;
    const file = req.file;

    logger.info('Starting direct Bundle.social video upload:', {
      originalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      userId: req.user.id,
      teamId: req.user.bundleTeamId
    });

    try {
      // Upload directly to Bundle.social using file buffer from memory
      const bundleUpload = await bundleSocialService.uploadVideo(req.user.bundleTeamId, {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype
      });

      // Create video record with Bundle.social upload ID only
      const video = await Video.create({
        user: req.user.id,
        title,
        description,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        bundleUploadId: bundleUpload.id,
        storageType: 'bundle_social_direct',
        status: 'completed'
      });

      logger.info('Video uploaded successfully directly to Bundle.social:', { 
        videoId: video._id, 
        bundleUploadId: bundleUpload.id,
        userId: req.user.id,
        storageType: 'bundle_social_direct'
      });

      sendCreated(res, 'Video uploaded successfully to Bundle.social', { 
        video: {
          ...video.toObject(),
          message: 'Video uploaded directly to Bundle.social without local storage'
        }
      });

    } catch (bundleError) {
      logger.error('Bundle.social direct upload failed:', {
        error: bundleError.message,
        userId: req.user.id,
        teamId: req.user.bundleTeamId,
        originalName: file.originalname
      });

      // Return error to user (no cleanup needed since no local file was saved)
      return next(new Error(`Failed to upload video directly to Bundle.social: ${bundleError.message}`));
    }

  } catch (error) {
    logger.error('Video upload error:', error);
    next(error);
  }
};

// Get user's videos - following specification pattern
const getUserVideos = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    // Verify user access (users can only access their own videos or admin access)
    if (id !== req.user.id && req.user.role !== 'admin') {
      return sendNotFound(res, 'Access denied');
    }

    const filter = { user: id };
    if (status) {
      filter.status = status;
    }

    const videos = await Video.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Video.countDocuments(filter);
    const meta = getPaginationMeta(page, limit, total);

    // Format video data for response
    const formattedVideos = videos.map(video => ({
      ...video.toObject(),
      fileSizeFormatted: formatFileSize(video.fileSize),
      durationFormatted: video.duration ? formatDuration(video.duration) : null
    }));

    sendSuccess(res, 'User videos retrieved successfully', { videos: formattedVideos }, meta);
  } catch (error) {
    logger.error('Get user videos error:', error);
    next(error);
  }
};

// Get user's videos (legacy method for backward compatibility)
const getVideos = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = { user: req.user.id };
    if (status) {
      filter.status = status;
    }

    const videos = await Video.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Video.countDocuments(filter);
    const meta = getPaginationMeta(page, limit, total);

    // Format video data for response
    const formattedVideos = videos.map(video => ({
      ...video.toObject(),
      fileSizeFormatted: formatFileSize(video.fileSize),
      durationFormatted: video.duration ? formatDuration(video.duration) : null
    }));

    sendSuccess(res, 'Videos retrieved successfully', { videos: formattedVideos }, meta);
  } catch (error) {
    logger.error('Get videos error:', error);
    next(error);
  }
};

// Get single video
const getVideo = async (req, res, next) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    const formattedVideo = {
      ...video.toObject(),
      fileSizeFormatted: formatFileSize(video.fileSize),
      durationFormatted: video.duration ? formatDuration(video.duration) : null
    };

    sendSuccess(res, 'Video retrieved successfully', { video: formattedVideo });
  } catch (error) {
    logger.error('Get video error:', error);
    next(error);
  }
};

// Update video
const updateVideo = async (req, res, next) => {
  try {
    const allowedFields = ['title', 'description', 'edits'];
    const updateData = {};

    // Filter allowed fields
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const video = await Video.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    logger.info('Video updated successfully:', { videoId: video._id, userId: req.user.id });

    sendSuccess(res, 'Video updated successfully', { video });
  } catch (error) {
    logger.error('Update video error:', error);
    next(error);
  }
};

// Delete video
const deleteVideo = async (req, res, next) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Delete from Bundle.social if uploaded there
    if (video.bundleUploadId) {
      try {
        await bundleSocialService.deleteUpload(video.bundleUploadId);
        logger.info('Video deleted from Bundle.social:', { bundleUploadId: video.bundleUploadId });
      } catch (bundleError) {
        logger.warn('Failed to delete from Bundle.social:', bundleError.message);
        // Continue with database deletion even if Bundle.social deletion fails
      }
    }

    // Delete local file only if it was stored locally (legacy videos)
    if (video.storageType === 'local' && video.filePath) {
      const fs = require('fs');
      try {
        if (fs.existsSync(video.filePath)) {
          fs.unlinkSync(video.filePath);
          logger.info('Local file deleted:', { filePath: video.filePath });
        }
      } catch (fileError) {
        logger.warn('Failed to delete local file:', fileError.message);
      }
    }

    await Video.findByIdAndDelete(req.params.id);

    logger.info('Video deleted successfully:', { 
      videoId: req.params.id, 
      userId: req.user.id,
      storageType: video.storageType,
      bundleUploadId: video.bundleUploadId
    });

    sendSuccess(res, 'Video deleted successfully');
  } catch (error) {
    logger.error('Delete video error:', error);
    next(error);
  }
};

// Generate AI caption for video using Gemini
const generateAICaption = async (req, res, next) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    const geminiService = require('../services/geminiService');
    
    const options = {
      prompt: req.body.prompt,
      tone: req.body.tone || 'casual',
      includeHashtags: req.body.includeHashtags !== false,
      maxLength: req.body.maxLength || 300,
      platform: req.body.platform || 'general'
    };

    const aiCaption = await geminiService.generateCaption(video, options);

    // Update video with AI generated content
    video.aiGeneratedCaption = aiCaption.caption;
    video.aiGeneratedHashtags = aiCaption.hashtags;
    await video.save();

    logger.info('AI caption generated with Gemini:', { videoId: video._id, userId: req.user.id });

    sendSuccess(res, 'AI caption generated successfully', {
      caption: aiCaption.caption,
      hashtags: aiCaption.hashtags,
      fullText: aiCaption.fullText,
      model: aiCaption.model
    });
  } catch (error) {
    logger.error('Generate AI caption error:', error);
    next(error);
  }
};

// Get video analytics
const getVideoAnalytics = async (req, res, next) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('user', 'name email');

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Get analytics from Bundle.social if available
    let analytics = {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0
    };

    if (video.bundleUploadId) {
      try {
        // Bundle.social analytics would be fetched here
        logger.info('Fetching analytics from Bundle.social:', { bundleUploadId: video.bundleUploadId });
      } catch (analyticsError) {
        logger.warn('Failed to fetch analytics:', analyticsError.message);
      }
    }

    sendSuccess(res, 'Video analytics retrieved', {
      video: {
        id: video._id,
        title: video.title,
        createdAt: video.createdAt
      },
      analytics
    });
  } catch (error) {
    logger.error('Get video analytics error:', error);
    next(error);
  }
};

module.exports = {
  uploadVideo,
  getVideos,
  getUserVideos,
  getVideo,
  updateVideo,
  deleteVideo,
  generateAICaption,
  getVideoAnalytics
};