const express = require('express');
const videoController = require('../controllers/videoController');
const { protect } = require('../middleware/auth');
const { ensureBundleSetup } = require('../middleware/bundleSetup');
const { uploadVideo, uploadVideoMemory, handleMulterError } = require('../middleware/upload');
const { validate, validateVideoUpload } = require('../middleware/validation');
// const { uploadLimiter } = require('../middleware/rateLimiting');
const { videoUploadSchema, videoEditSchema, aiCaptionSchema } = require('../utils/validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Videos
 *   description: Video upload, management, and processing
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/videos/upload:
 *   post:
 *     summary: Upload a video file directly to Bundle.social
 *     description: |
 *       Upload a video file directly to Bundle.social without local storage.
 *       The video is processed in memory and immediately uploaded to Bundle.social platform.
 *       Only the Bundle.social upload ID is stored in the database.
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video  
 *               - title
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file to upload directly to Bundle.social (MP4, AVI, MOV, WMV formats supported, max 100MB)
 *               title:
 *                 type: string
 *                 description: Video title (required, 1-100 characters)
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: My awesome video
 *               description:
 *                 type: string
 *                 description: Optional video description (max 500 characters)
 *                 maxLength: 500
 *                 example: This is a great video about...
 *     responses:
 *       201:
 *         description: Video uploaded successfully directly to Bundle.social
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Video uploaded successfully to Bundle.social
 *                 data:
 *                   type: object
 *                   properties:
 *                     video:
 *                       allOf:
 *                         - $ref: '#/components/schemas/Video'
 *                         - type: object
 *                           properties:
 *                             bundleUploadId:
 *                               type: string
 *                               description: Bundle.social upload ID
 *                               example: bundle_123456789
 *                             storageType:
 *                               type: string
 *                               enum: [bundle_social_direct]
 *                               example: bundle_social_direct
 *                             message:
 *                               type: string
 *                               example: Video uploaded directly to Bundle.social without local storage
 *       400:
 *         description: Invalid file or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/upload',
  // uploadLimiter, // DISABLED - no rate limiting requested
  ensureBundleSetup, // Ensure Bundle.social is set up before upload
  uploadVideoMemory.single('video'), // Use memory storage for direct Bundle.social upload
  handleMulterError,
  validateVideoUpload,
  validate(videoUploadSchema),
  videoController.uploadVideo
);

/**
 * @swagger
 * /api/v1/videos/uploads:
 *   get:
 *     summary: Get all uploads from Bundle.social
 *     description: |
 *       Fetch all uploads (images and videos) from Bundle.social for the authenticated user's team.
 *       Automatically syncs thumbnail data with local database for videos.
 *     tags: [Videos]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [image, video]
 *         description: Filter by upload type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [USED, UNUSED]
 *         description: Filter by usage status (USED = used in posts, UNUSED = not used)
 *     responses:
 *       200:
 *         description: Uploads retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Uploads retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploads:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             description: Bundle.social upload ID
 *                           teamId:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [image, video]
 *                           thumbnailUrl:
 *                             type: string
 *                             description: URL to thumbnail image
 *                           iconUrl:
 *                             type: string
 *                             description: URL to small icon/preview
 *                           url:
 *                             type: string
 *                             description: URL to full media file
 *                           width:
 *                             type: number
 *                           height:
 *                             type: number
 *                           fileSize:
 *                             type: number
 *                           videoLength:
 *                             type: number
 *                             description: Video duration in seconds
 *                           mime:
 *                             type: string
 *                           ext:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           posts:
 *                             type: array
 *                             description: Posts using this upload
 *                             items:
 *                               type: object
 *                               properties:
 *                                 postId:
 *                                   type: string
 *                                 uploadId:
 *                                   type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         videos:
 *                           type: number
 *                         images:
 *                           type: number
 *                         used:
 *                           type: number
 *                         unused:
 *                           type: number
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/uploads', videoController.getAllUploads);

/**
 * @swagger
 * /api/v1/videos/user/{id}:
 *   get:
 *     summary: Get videos by user ID
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of videos per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [uploading, processing, completed, failed]
 *         description: Filter by video status
 *     responses:
 *       200:
 *         description: User videos retrieved successfully
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
 *                     videos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Video'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         total:
 *                           type: number
 *                         pages:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/user/:id', videoController.getUserVideos);

/**
 * @swagger
 * /api/v1/videos/{id}:
 *   get:
 *     summary: Get video by ID
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video retrieved successfully
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
 *                     video:
 *                       $ref: '#/components/schemas/Video'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   patch:
 *     summary: Update video details
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated video title
 *               description:
 *                 type: string
 *                 example: Updated video description
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["updated", "tags"]
 *     responses:
 *       200:
 *         description: Video updated successfully
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
 *                     video:
 *                       $ref: '#/components/schemas/Video'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Delete video
 *     description: |
 *       Permanently deletes a video from both the database and Bundle.social.
 *       This action also removes the video from the user's videos array.
 *       
 *       **What gets deleted:**
 *       - Video record from database
 *       - Video upload from Bundle.social (if bundleUploadId exists)
 *       - Local file (only for legacy videos with local storage)
 *       - Video ID from user's videos array
 *       
 *       If Bundle.social deletion fails, the database deletion will still proceed.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video deleted successfully from database and Bundle.social
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Video deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router
  .route('/:id')
  .get(videoController.getVideo)
  .patch(validate(videoEditSchema), videoController.updateVideo)
  .delete(videoController.deleteVideo);

/**
 * @swagger
 * /api/v1/videos/{id}/ai-caption:
 *   post:
 *     summary: Generate AI caption for video using Gemini
 *     description: Generate engaging social media captions using Google's Gemini AI. Customize tone, platform, and include hashtags based on your preferences.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AICaptionRequest'
 *           examples:
 *             casual_instagram:
 *               summary: Casual Instagram Caption
 *               description: Generate a casual caption optimized for Instagram
 *               value:
 *                 tone: "casual"
 *                 platform: "instagram"
 *                 includeHashtags: true
 *                 maxLength: 300
 *                 prompt: "Focus on lifestyle and fun vibes"
 *             professional_linkedin:
 *               summary: Professional LinkedIn Caption
 *               description: Generate a professional caption for LinkedIn
 *               value:
 *                 tone: "professional"
 *                 platform: "linkedin"
 *                 includeHashtags: true
 *                 maxLength: 500
 *                 prompt: "Highlight business insights and professional growth"
 *             funny_tiktok:
 *               summary: Funny TikTok Caption
 *               description: Generate a humorous caption for TikTok
 *               value:
 *                 tone: "funny"
 *                 platform: "tiktok"
 *                 includeHashtags: true
 *                 maxLength: 200
 *     responses:
 *       200:
 *         description: AI caption generated successfully using Gemini
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: AI caption generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     caption:
 *                       type: string
 *                       example: "Check out this amazing video! 🎬✨ Perfect for your daily dose of inspiration and creativity."
 *                     hashtags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["video", "content", "amazing", "inspiration", "creativity"]
 *                     fullText:
 *                       type: string
 *                       example: "Caption: Check out this amazing video! 🎬✨ Perfect for your daily dose of inspiration and creativity.\nHashtags: #video #content #amazing #inspiration #creativity"
 *                     model:
 *                       type: string
 *                       example: "gemini-1.5-flash"
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Gemini AI service error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:id/ai-caption',
  validate(aiCaptionSchema),
  videoController.generateAICaption
);

/**
 * @swagger
 * /api/v1/videos/{id}/analytics:
 *   get:
 *     summary: Get video analytics
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Analytics period
 *     responses:
 *       200:
 *         description: Video analytics retrieved successfully
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
 *                     views:
 *                       type: number
 *                       example: 1542
 *                     likes:
 *                       type: number
 *                       example: 89
 *                     comments:
 *                       type: number
 *                       example: 23
 *                     shares:
 *                       type: number
 *                       example: 15
 *                     engagement:
 *                       type: object
 *                       properties:
 *                         rate:
 *                           type: number
 *                           example: 8.2
 *                         avgWatchTime:
 *                           type: number
 *                           example: 45.6
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id/analytics', videoController.getVideoAnalytics);

module.exports = router;