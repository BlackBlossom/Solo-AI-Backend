const Video = require('../models/Video');
const falAiService = require('../services/falAiService');
const configService = require('../services/configService');
const { 
  sendSuccess, 
  sendBadRequest, 
  sendNotFound 
} = require('../utils/response');
const logger = require('../utils/logger');

// Generate AI caption for video
const generateCaption = async (req, res, next) => {
  try {
    const { videoId, tone, includeHashtags, maxLength, platform, platforms } = req.body;

    // Verify video exists and belongs to user
    const video = await Video.findOne({
      _id: videoId,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Validate platform(s)
    if (platforms && !Array.isArray(platforms)) {
      return sendBadRequest(res, 'platforms must be an array');
    }

    const options = {
      tone: tone || 'casual',
      includeHashtags: includeHashtags !== false,
      maxLength: maxLength || 300,
      platform: platform || 'instagram',
      platforms: platforms || []
    };

    // Generate AI caption using Fal.ai
    const result = await falAiService.generateCaption(video, options);

    // Update video with generated content
    video.aiGeneratedCaption = result.caption;
    video.aiGeneratedHashtags = result.hashtags;
    await video.save();

    logger.info('AI caption generated:', { 
      videoId: video._id, 
      userId: req.user.id,
      captionLength: result.caption.length,
      hashtagCount: result.hashtags.length,
      platform: result.platform
    });

    sendSuccess(res, 'AI caption generated successfully', {
      caption: result.caption,
      hashtags: result.hashtags,
      fullText: result.fullText,
      videoId: video._id,
      platform: result.platform,
      model: result.model
    });
  } catch (error) {
    logger.error('Generate AI caption error:', error);
    next(error);
  }
};

// Generate hashtags for content
const generateHashtags = async (req, res, next) => {
  try {
    const { content, maxCount, platform } = req.body;

    if (!content || content.trim().length === 0) {
      return sendBadRequest(res, 'Content is required for hashtag generation');
    }

    const options = {
      maxCount: maxCount || 10,
      platform: platform || 'instagram'
    };

    const hashtags = await falAiService.generateHashtags(content, options);

    logger.info('AI hashtags generated:', { 
      userId: req.user.id,
      hashtagCount: hashtags.length,
      contentLength: content.length,
      platform: options.platform
    });

    sendSuccess(res, 'Hashtags generated successfully', {
      hashtags,
      platform: options.platform,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
    });
  } catch (error) {
    logger.error('Generate hashtags error:', error);
    next(error);
  }
};

// Optimize caption for specific platform
const optimizeCaption = async (req, res, next) => {
  try {
    const { caption, platform } = req.body;

    if (!caption || caption.trim().length === 0) {
      return sendBadRequest(res, 'Caption is required for optimization');
    }

    if (!platform) {
      return sendBadRequest(res, 'Platform is required for optimization');
    }

    // Use Fal.ai to optimize caption for platform
    const optimizedCaption = await falAiService.optimizeForPlatform(caption, platform);

    logger.info('Caption optimized for platform:', { 
      userId: req.user.id,
      platform,
      originalLength: caption.length,
      optimizedLength: optimizedCaption.length
    });

    sendSuccess(res, 'Caption optimized successfully', {
      originalCaption: caption,
      optimizedCaption,
      platform
    });
  } catch (error) {
    logger.error('Optimize caption error:', error);
    next(error);
  }
};

// Get AI suggestions for video
const getVideoSuggestions = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const { tone } = req.query;

    // Verify video exists and belongs to user
    const video = await Video.findOne({
      _id: videoId,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Generate suggestions for multiple platforms
    const platforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'];
    
    const suggestions = await falAiService.generateMultiPlatformSuggestions(
      video,
      platforms,
      tone || 'casual'
    );

    logger.info('AI suggestions generated for video:', { 
      videoId: video._id, 
      userId: req.user.id,
      platformCount: Object.keys(suggestions).length,
      tone: tone || 'casual'
    });

    sendSuccess(res, 'Video suggestions generated', {
      videoId: video._id,
      videoTitle: video.title,
      tone: tone || 'casual',
      suggestions
    });
  } catch (error) {
    logger.error('Get video suggestions error:', error);
    next(error);
  }
};

// Analyze content performance (mock for MVP)
const analyzeContent = async (req, res, next) => {
  try {
    const { content, platform } = req.body;

    if (!content || content.trim().length === 0) {
      return sendBadRequest(res, 'Content is required for analysis');
    }

    // For MVP, provide a mock analysis
    // In production, this could use AI to analyze content effectiveness
    const analysis = {
      score: Math.floor(Math.random() * 40) + 60, // Random score between 60-100
      suggestions: [
        'Consider adding more engaging questions to encourage comments',
        'Include trending hashtags for better discoverability',
        'Add a clear call-to-action at the end',
        'Use emojis to make the content more visually appealing'
      ],
      sentiment: 'positive',
      readabilityScore: Math.floor(Math.random() * 20) + 80,
      estimatedReach: Math.floor(Math.random() * 5000) + 1000,
      keyTopics: ['video', 'content', 'social media'],
      platform: platform || 'general'
    };

    logger.info('Content analyzed:', { 
      userId: req.user.id,
      contentLength: content.length,
      score: analysis.score
    });

    sendSuccess(res, 'Content analysis completed', {
      analysis,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
    });
  } catch (error) {
    logger.error('Analyze content error:', error);
    next(error);
  }
};

// Get AI service status and capabilities
const getAIStatus = async (req, res, next) => {
  try {
    // Get API key from database settings first
    const apiKeys = await configService.getApiKeys();
    const falApiKey = apiKeys.falApiKey || process.env.FAL_API_KEY;
    const falModel = apiKeys.falModel || process.env.FAL_MODEL || 'fal-ai/flux/dev';
    
    const status = {
      available: !!falApiKey,
      provider: 'Fal.ai',
      model: falModel,
      models: {
        flux_dev: 'fal-ai/flux/dev - Fast image and text generation (default)',
        flux_pro: 'fal-ai/flux-pro - Professional quality generation',
        flux_schnell: 'fal-ai/flux/schnell - Ultra-fast generation'
      },
      capabilities: {
        captionGeneration: true,
        hashtagGeneration: true,
        platformOptimization: true,
        contentAnalysis: true,
        multiPlatformSuggestions: true,
        realTimeData: false // Fal.ai is a generative AI service
      },
      supportedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'pinterest'],
      supportedTones: ['professional', 'casual', 'funny', 'inspirational', 'educational', 'storytelling', 'urgent', 'luxury'],
      limits: {
        maxCaptionLength: 5000,
        maxHashtags: 30,
        requestsPerMinute: 10 // Fal.ai rate limits
      },
      configSource: apiKeys.falApiKey ? 'database' : 'environment'
    };

    sendSuccess(res, 'AI service status retrieved', { status });
  } catch (error) {
    logger.error('Get AI status error:', error);
    next(error);
  }
};

// Check Perplexity API health
const checkAIHealth = async (req, res, next) => {
  try {
    const health = await falAiService.checkAPIHealth();
    
    if (health.healthy) {
      sendSuccess(res, 'Fal.ai API is healthy', health);
    } else {
      res.status(503).json({
        status: 'error',
        message: 'Fal.ai API is unavailable',
        data: health
      });
    }
  } catch (error) {
    logger.error('Check AI health error:', error);
    next(error);
  }
};

module.exports = {
  generateCaption,
  generateHashtags,
  optimizeCaption,
  getVideoSuggestions,
  analyzeContent,
  getAIStatus,
  checkAIHealth
};