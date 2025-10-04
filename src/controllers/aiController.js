const Video = require('../models/Video');
const geminiService = require('../services/geminiService');
const { 
  sendSuccess, 
  sendBadRequest, 
  sendNotFound 
} = require('../utils/response');
const logger = require('../utils/logger');

// Generate AI caption for video
const generateCaption = async (req, res, next) => {
  try {
    const { videoId, prompt, tone, includeHashtags, maxLength, platform } = req.body;

    // Verify video exists and belongs to user
    const video = await Video.findOne({
      _id: videoId,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    const options = {
      prompt,
      tone: tone || 'casual',
      includeHashtags: includeHashtags !== false,
      maxLength: maxLength || 300,
      platform: platform || 'general'
    };

    // Generate AI caption using Gemini
    const result = await geminiService.generateCaption(video, options);

    // Update video with generated content
    video.aiGeneratedCaption = result.caption;
    video.aiGeneratedHashtags = result.hashtags;
    await video.save();

    logger.info('AI caption generated:', { 
      videoId: video._id, 
      userId: req.user.id,
      captionLength: result.caption.length,
      hashtagCount: result.hashtags.length
    });

    sendSuccess(res, 'AI caption generated successfully', {
      caption: result.caption,
      hashtags: result.hashtags,
      fullText: result.fullText,
      videoId: video._id
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
      platform: platform || 'general'
    };

    const hashtags = await geminiService.generateHashtags(content, options);

    logger.info('AI hashtags generated:', { 
      userId: req.user.id,
      hashtagCount: hashtags.length,
      contentLength: content.length
    });

    sendSuccess(res, 'Hashtags generated successfully', {
      hashtags,
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

    // Use Gemini to optimize caption for platform
    const optimizedCaption = await geminiService.optimizeForPlatform(caption, platform);

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

    // Verify video exists and belongs to user
    const video = await Video.findOne({
      _id: videoId,
      user: req.user.id
    });

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Generate suggestions for multiple platforms
    const platforms = ['instagram', 'tiktok', 'youtube', 'facebook'];
    const suggestions = {};

    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const result = await geminiService.generateCaption(video, {
            platform,
            tone: 'casual',
            includeHashtags: true,
            maxLength: platform === 'twitter' ? 280 : 300
          });

          suggestions[platform] = {
            caption: result.caption,
            hashtags: result.hashtags,
            fullText: result.fullText
          };
        } catch (platformError) {
          logger.warn(`Failed to generate suggestion for ${platform}:`, platformError.message);
          suggestions[platform] = {
            caption: video.aiGeneratedCaption || '',
            hashtags: video.aiGeneratedHashtags || [],
            error: 'Failed to generate platform-specific suggestion'
          };
        }
      })
    );

    logger.info('AI suggestions generated for video:', { 
      videoId: video._id, 
      userId: req.user.id,
      platformCount: Object.keys(suggestions).length
    });

    sendSuccess(res, 'Video suggestions generated', {
      videoId: video._id,
      videoTitle: video.title,
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
    const status = {
      available: !!process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
      capabilities: {
        captionGeneration: true,
        hashtagGeneration: true,
        platformOptimization: true,
        contentAnalysis: true,
        multiPlatformSuggestions: true
      },
      supportedPlatforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'],
      supportedTones: ['professional', 'casual', 'funny', 'inspirational', 'educational'],
      limits: {
        maxCaptionLength: 2200,
        maxHashtags: 30,
        requestsPerMinute: 10
      }
    };

    sendSuccess(res, 'AI service status retrieved', { status });
  } catch (error) {
    logger.error('Get AI status error:', error);
    next(error);
  }
};

module.exports = {
  generateCaption,
  generateHashtags,
  optimizeCaption,
  getVideoSuggestions,
  analyzeContent,
  getAIStatus
};