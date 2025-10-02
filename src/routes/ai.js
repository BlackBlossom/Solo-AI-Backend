const express = require('express');
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { aiCaptionSchema } = require('../utils/validation');
const Joi = require('joi');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered content generation and optimization
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/ai/status:
 *   get:
 *     summary: Get AI service status
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: AI service status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [active, inactive, maintenance]
 *                       example: active
 *                     services:
 *                       type: object
 *                       properties:
 *                         captionGeneration:
 *                           type: boolean
 *                         hashtagGeneration:
 *                           type: boolean
 *                         contentOptimization:
 *                           type: boolean
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/status', aiController.getAIStatus);

/**
 * @swagger
 * /api/v1/ai/generate-caption:
 *   post:
 *     summary: Generate AI-powered caption for video
 *     tags: [AI]
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
 *               prompt:
 *                 type: string
 *                 maxLength: 500
 *                 description: Custom prompt for caption generation
 *                 example: "Create an engaging caption about cooking tips"
 *               tone:
 *                 type: string
 *                 enum: [professional, casual, funny, inspirational, educational]
 *                 example: casual
 *               includeHashtags:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to include hashtags in the caption
 *               maxLength:
 *                 type: integer
 *                 minimum: 50
 *                 maximum: 2200
 *                 description: Maximum caption length
 *               platform:
 *                 type: string
 *                 enum: [instagram, tiktok, youtube, facebook, twitter, linkedin, general]
 *                 description: Target platform for optimization
 *     responses:
 *       200:
 *         description: Caption generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
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
 *                       example: ["#cooking", "#tutorial", "#foodie", "#recipe"]
 *                     wordCount:
 *                       type: number
 *                       example: 87
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
 *       500:
 *         description: AI service error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const generateCaptionSchema = Joi.object({
  videoId: Joi.string().required(),
  prompt: Joi.string().max(500).optional(),
  tone: Joi.string().valid('professional', 'casual', 'funny', 'inspirational', 'educational').optional(),
  includeHashtags: Joi.boolean().optional(),
  maxLength: Joi.number().integer().min(50).max(2200).optional(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'general').optional()
});

router.post('/generate-caption', validate(generateCaptionSchema), aiController.generateCaption);

// Hashtag generation
const generateHashtagsSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  maxCount: Joi.number().integer().min(1).max(30).optional(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'general').optional()
});

router.post('/hashtags', validate(generateHashtagsSchema), aiController.generateHashtags);

// Caption optimization
const optimizeCaptionSchema = Joi.object({
  caption: Joi.string().min(1).max(2200).required(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin').required()
});

router.post('/optimize', validate(optimizeCaptionSchema), aiController.optimizeCaption);

// Video suggestions
router.get('/suggestions/:videoId', aiController.getVideoSuggestions);

// Content analysis
const analyzeContentSchema = Joi.object({
  content: Joi.string().min(1).max(2200).required(),
  platform: Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'general').optional()
});

router.post('/analyze', validate(analyzeContentSchema), aiController.analyzeContent);

module.exports = router;