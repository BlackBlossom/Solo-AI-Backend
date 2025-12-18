const express = require('express');
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { aiCaptionSchema } = require('../utils/validation');
const Joi = require('joi');
const aiRateLimiter = require('../middleware/aiRateLimit');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered content generation and optimization using Fal.ai
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/ai/status:
 *   get:
 *     summary: Get AI service status and capabilities
 *     description: Check Fal.ai service availability, supported platforms, tones, and capabilities
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI service status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: AI service status retrieved
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: object
 *                       properties:
 *                         available:
 *                           type: boolean
 *                           example: true
 *                         provider:
 *                           type: string
 *                           example: Fal.ai
 *                         model:
 *                           type: string
 *                           example: fal-ai/flux/dev
 *                         models:
 *                           type: object
 *                           properties:
 *                             flux_dev:
 *                               type: string
 *                               example: fal-ai/flux/dev - Fast image and text generation (default)
 *                             flux_pro:
 *                               type: string
 *                               example: fal-ai/flux-pro - Professional quality generation
 *                             flux_schnell:
 *                               type: string
 *                               example: fal-ai/flux/schnell - Ultra-fast generation
 *                         capabilities:
 *                           type: object
 *                           properties:
 *                             captionGeneration:
 *                               type: boolean
 *                             hashtagGeneration:
 *                               type: boolean
 *                             platformOptimization:
 *                               type: boolean
 *                             contentAnalysis:
 *                               type: boolean
 *                             multiPlatformSuggestions:
 *                               type: boolean
 *                             realTimeData:
 *                               type: boolean
 *                               description: false for Fal.ai (generative AI service)
 *                         supportedPlatforms:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: [instagram, tiktok, youtube, facebook, twitter, linkedin, pinterest]
 *                         supportedTones:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: [professional, casual, funny, inspirational, educational, storytelling, urgent, luxury]
 *                         limits:
 *                           type: object
 *                           properties:
 *                             maxCaptionLength:
 *                               type: number
 *                               example: 5000
 *                             maxHashtags:
 *                               type: number
 *                               example: 30
 *                             requestsPerMinute:
 *                               type: number
 *                               example: 10
 *                         configSource:
 *                           type: string
 *                           enum: [database, environment]
 *                           description: Source of API configuration
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/status', aiController.getAIStatus);

/**
 * @swagger
 * /api/v1/ai/health:
 *   get:
 *     summary: Check Fal.ai API health
 *     description: Test connection to Fal.ai API and verify API key is working
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fal.ai API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Fal.ai API is healthy
 *                 data:
 *                   type: object
 *                   properties:
 *                     healthy:
 *                       type: boolean
 *                     model:
 *                       type: string
 *                     response:
 *                       type: string
 *       503:
 *         description: Fal.ai API is unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Fal.ai API is unavailable
 */
router.get('/health', aiController.checkAIHealth);

/**
 * @swagger
 * /api/v1/ai/generate-caption:
 *   post:
 *     summary: Generate AI-powered caption for video using Fal.ai
 *     description: |
 *       Automatically generates platform-optimized captions with intelligent prompt engineering.
 *       No manual prompt needed - the AI automatically applies platform-specific best practices,
 *       character limits, hashtag strategies, and engagement optimization.
 *       
 *       **Features:**
 *       - Platform-specific optimization (Instagram, TikTok, YouTube, etc.)
 *       - 8 different tone options
 *       - Automatic hashtag generation with trending suggestions
 *       - AI-powered text generation using Fal.ai models
 *       - Smart emoji placement and formatting
 *       - Multiple model options (flux/dev, flux-pro, flux/schnell)
 *       
 *       **Rate Limit:** 10 requests per minute
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoId
 *             properties:
 *               videoId:
 *                 type: string
 *                 description: ID of the video to generate caption for
 *                 example: "67890abcdef12345"
 *               tone:
 *                 type: string
 *                 enum: [professional, casual, funny, inspirational, educational, storytelling, urgent, luxury]
 *                 default: casual
 *                 description: |
 *                   Tone of the generated caption:
 *                   - **professional**: Formal, expert, credible
 *                   - **casual**: Friendly, conversational (default)
 *                   - **funny**: Humorous, witty, entertaining
 *                   - **inspirational**: Motivational, uplifting
 *                   - **educational**: Informative, teaching-focused
 *                   - **storytelling**: Narrative-driven, emotional
 *                   - **urgent**: FOMO-inducing, action-oriented
 *                   - **luxury**: Sophisticated, exclusive
 *                 example: casual
 *               includeHashtags:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to include trending, relevant hashtags
 *               maxLength:
 *                 type: integer
 *                 minimum: 50
 *                 maximum: 5000
 *                 default: 300
 *                 description: Maximum caption length (platform-specific defaults apply)
 *               platform:
 *                 type: string
 *                 enum: [instagram, tiktok, youtube, facebook, twitter, linkedin, pinterest]
 *                 default: instagram
 *                 description: |
 *                   Target platform for optimization:
 *                   - **instagram**: 2,200 chars, 15-20 hashtags, visual with emojis
 *                   - **tiktok**: 2,200 chars, 3-5 trending, casual Gen Z language
 *                   - **youtube**: 5,000 chars, 3-5 hashtags, SEO-optimized
 *                   - **facebook**: 63,206 chars, 2-3 hashtags, story-driven
 *                   - **twitter**: 280 chars, 1-2 hashtags, concise and witty
 *                   - **linkedin**: 3,000 chars, 3-5 hashtags, professional
 *                   - **pinterest**: 500 chars, 5-10 hashtags, keyword-rich
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [instagram, tiktok, youtube, facebook, twitter, linkedin, pinterest]
 *                 description: Array of platforms for multi-platform optimization (optional)
 *                 example: ["instagram", "tiktok"]
 *           examples:
 *             instagram_casual:
 *               summary: Instagram - Casual tone
 *               value:
 *                 videoId: "67890abcdef12345"
 *                 platform: "instagram"
 *                 tone: "casual"
 *                 includeHashtags: true
 *             youtube_professional:
 *               summary: YouTube - Professional tone
 *               value:
 *                 videoId: "67890abcdef12345"
 *                 platform: "youtube"
 *                 tone: "professional"
 *                 maxLength: 5000
 *             tiktok_funny:
 *               summary: TikTok - Funny tone
 *               value:
 *                 videoId: "67890abcdef12345"
 *                 platform: "tiktok"
 *                 tone: "funny"
 *     responses:
 *       200:
 *         description: Caption generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: AI caption generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     caption:
 *                       type: string
 *                       example: "🎬 Just dropped this amazing cooking tutorial! Who else loves experimenting in the kitchen? Let me know your favorite recipes below! 👇"
 *                     hashtags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["cooking", "tutorial", "foodie", "recipe", "kitchenhacks"]
 *                     fullText:
 *                       type: string
 *                       description: Complete generated text including formatting
 *                     videoId:
 *                       type: string
 *                     platform:
 *                       type: string
 *                       example: instagram
 *                     model:
 *                       type: string
 *                       example: fal-ai/flux/dev
 *                       description: Fal.ai model used for generation
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Video not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Fal.ai API rate limit exceeded. Please try again in a few moments.
 *       500:
 *         description: AI service error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const generateCaptionSchema = Joi.object({
  videoId: Joi.string().required(),
  tone: Joi.string().valid('professional', 'casual', 'funny', 'inspirational', 'educational', 'storytelling', 'urgent', 'luxury').optional(),
  includeHashtags: Joi.boolean().optional(),
  maxLength: Joi.number().integer().min(50).max(5000).optional(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'pinterest').optional(),
  platforms: Joi.array().items(Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'pinterest')).optional()
});

router.post('/generate-caption', aiRateLimiter, validate(generateCaptionSchema), aiController.generateCaption);

/**
 * @swagger
 * /api/v1/ai/hashtags:
 *   post:
 *     summary: Generate trending hashtags for content
 *     description: |
 *       Generate strategic, platform-specific hashtags using Fal.ai.
 *       Automatically selects a mix of high-volume, niche, and trending hashtags
 *       optimized for the target platform's algorithm.
 *       
 *       **Rate Limit:** 10 requests per minute
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: The content to generate hashtags for
 *                 example: "Amazing workout routine for beginners focusing on core strength"
 *               maxCount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 30
 *                 default: 10
 *                 description: Maximum number of hashtags to generate
 *               platform:
 *                 type: string
 *                 enum: [instagram, tiktok, youtube, facebook, twitter, linkedin, pinterest]
 *                 default: instagram
 *                 description: Target platform for hashtag optimization
 *     responses:
 *       200:
 *         description: Hashtags generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Hashtags generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     hashtags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["workout", "fitness", "core", "beginners", "fitnesstips"]
 *                     platform:
 *                       type: string
 *                       example: instagram
 *                     content:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Hashtag generation
const generateHashtagsSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  maxCount: Joi.number().integer().min(1).max(30).optional(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'pinterest').optional()
});

router.post('/hashtags', aiRateLimiter, validate(generateHashtagsSchema), aiController.generateHashtags);

/**
 * @swagger
 * /api/v1/ai/optimize:
 *   post:
 *     summary: Optimize caption for specific platform
 *     description: |
 *       Optimize an existing caption for a specific platform using Fal.ai.
 *       Adapts formatting, length, style, and engagement elements to match
 *       platform-specific best practices and algorithm preferences.
 *       
 *       **Rate Limit:** 10 requests per minute
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caption
 *               - platform
 *             properties:
 *               caption:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2200
 *                 description: The original caption to optimize
 *                 example: "Check out my new video about cooking pasta"
 *               platform:
 *                 type: string
 *                 enum: [instagram, tiktok, youtube, facebook, twitter, linkedin, pinterest]
 *                 description: Target platform for optimization
 *                 example: tiktok
 *     responses:
 *       200:
 *         description: Caption optimized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Caption optimized successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     originalCaption:
 *                       type: string
 *                     optimizedCaption:
 *                       type: string
 *                       example: "🍝 POV: Making the BEST pasta you've ever tasted! Who else is obsessed with cooking? Drop a 🍝 if you're trying this! #CookingTikTok #PastaLover"
 *                     platform:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Caption optimization
const optimizeCaptionSchema = Joi.object({
  caption: Joi.string().min(1).max(2200).required(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'pinterest').required()
});

router.post('/optimize', aiRateLimiter, validate(optimizeCaptionSchema), aiController.optimizeCaption);

/**
 * @swagger
 * /api/v1/ai/suggestions/{videoId}:
 *   get:
 *     summary: Get multi-platform caption suggestions for a video
 *     description: |
 *       Get optimized caption suggestions for all major social media platforms
 *       in a single request. Each platform receives a caption optimized for
 *       its unique format, audience, and algorithm using Fal.ai.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the video to get suggestions for
 *       - in: query
 *         name: tone
 *         schema:
 *           type: string
 *           enum: [professional, casual, funny, inspirational, educational, storytelling, urgent, luxury]
 *           default: casual
 *         description: |
 *           Tone style for all platform captions:
 *           - **professional**: Formal, credible, authoritative with industry terminology
 *           - **casual**: Friendly, conversational, relatable with everyday language
 *           - **funny**: Humorous, witty, entertaining with jokes and playful language
 *           - **inspirational**: Motivational, uplifting, empowering with emotional appeal
 *           - **educational**: Informative, clear, instructive with step-by-step guidance
 *           - **storytelling**: Narrative-driven, engaging, descriptive with story arcs
 *           - **urgent**: Time-sensitive, action-oriented with FOMO and scarcity
 *           - **luxury**: Premium, sophisticated, exclusive with aspirational language
 *     responses:
 *       200:
 *         description: Multi-platform suggestions generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: AI suggestions generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     videoId:
 *                       type: string
 *                     tone:
 *                       type: string
 *                       example: casual
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           platform:
 *                             type: string
 *                             example: instagram
 *                           caption:
 *                             type: string
 *                           hashtags:
 *                             type: array
 *                             items:
 *                               type: string
 *                           config:
 *                             type: object
 *                             properties:
 *                               maxLength:
 *                                 type: integer
 *                               hashtagCount:
 *                                 type: string
 *                               style:
 *                                 type: string
 *                     model:
 *                       type: string
 *                       example: fal-ai/flux/dev
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

// Video suggestions
router.get('/suggestions/:videoId', aiController.getVideoSuggestions);

/**
 * @swagger
 * /api/v1/ai/analyze:
 *   post:
 *     summary: Analyze content performance (Mock)
 *     description: |
 *       Analyze content for performance predictions and optimization suggestions.
 *       This is a mock implementation for MVP - provides simulated analytics.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2200
 *                 description: The content to analyze
 *                 example: "Check out my new video about cooking pasta! Who else loves Italian food?"
 *               platform:
 *                 type: string
 *                 enum: [instagram, tiktok, youtube, facebook, twitter, linkedin, general]
 *                 default: general
 *                 description: Target platform for analysis
 *     responses:
 *       200:
 *         description: Content analyzed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Content analysis completed
 *                 data:
 *                   type: object
 *                   properties:
 *                     analysis:
 *                       type: object
 *                       properties:
 *                         score:
 *                           type: number
 *                           example: 85
 *                           description: Overall content score (60-100)
 *                         suggestions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["Consider adding more engaging questions", "Include trending hashtags"]
 *                         sentiment:
 *                           type: string
 *                           example: positive
 *                         readabilityScore:
 *                           type: number
 *                           example: 85
 *                         estimatedReach:
 *                           type: number
 *                           example: 2500
 *                         keyTopics:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["video", "content", "social media"]
 *                         platform:
 *                           type: string
 *                     content:
 *                       type: string
 *                       description: Truncated content preview
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Content analysis
const analyzeContentSchema = Joi.object({
  content: Joi.string().min(1).max(2200).required(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'general').optional()
});

router.post('/analyze', validate(analyzeContentSchema), aiController.analyzeContent);

module.exports = router;