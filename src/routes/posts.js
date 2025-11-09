const express = require('express');
const postController = require('../controllers/postController');
const newPostController = require('../controllers/newPostController');
const { protect } = require('../middleware/auth');
const { ensureBundleSetup } = require('../middleware/bundleSetup');
const { validate, validateQuery } = require('../middleware/validation');
const { postCreateSchema, postScheduleSchema, paginationSchema } = require('../utils/validation');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Post:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Post ID
 *         user:
 *           type: string
 *           description: User ID who created the post
 *         video:
 *           type: object
 *           description: Associated video information
 *         caption:
 *           type: string
 *           description: Post caption/content
 *         hashtags:
 *           type: array
 *           items:
 *             type: string
 *           description: Post hashtags
 *         platforms:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 enum: [instagram, tiktok, youtube, facebook, twitter, linkedin]
 *               accountId:
 *                 type: string
 *               postId:
 *                 type: string
 *               publishedAt:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [pending, scheduled, published, failed]
 *               errorMessage:
 *                 type: string
 *         scheduledFor:
 *           type: string
 *           format: date-time
 *           description: Scheduled publication time
 *         publishedAt:
 *           type: string
 *           format: date-time
 *           description: Actual publication time
 *         bundlePostId:
 *           type: string
 *           description: Bundle.social post ID
 *         bundleStatus:
 *           type: string
 *           enum: [draft, scheduled, posted, error, deleted, processing]
 *           description: Bundle.social post status
 *         bundleError:
 *           type: string
 *           description: General error message from Bundle.social
 *         bundleErrors:
 *           type: object
 *           description: Platform-specific errors from Bundle.social
 *         bundleExternalData:
 *           type: object
 *           description: Platform-specific post IDs and permalinks from Bundle.social
 *         settings:
 *           type: object
 *           properties:
 *             autoPublish:
 *               type: boolean
 *             allowComments:
 *               type: boolean
 *             allowLikes:
 *               type: boolean
 *             visibility:
 *               type: string
 *               enum: [public, private, unlisted]
 *         analytics:
 *           type: object
 *           properties:
 *             views:
 *               type: number
 *             likes:
 *               type: number
 *             comments:
 *               type: number
 *             shares:
 *               type: number
 *             lastUpdated:
 *               type: string
 *               format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 * tags:
 *   name: Posts
 *   description: Social media post management and scheduling with Bundle.social integration
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/posts/create:
 *   post:
 *     summary: Create and publish post immediately
 *     tags: [Posts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoId
 *               - caption
 *               - platforms
 *             properties:
 *               videoId:
 *                 type: string
 *                 description: Associated video ID (required)
 *                 example: 60f1b1b1b1b1b1b1b1b1b1b1
 *               caption:
 *                 type: string
 *                 description: Post caption/content (1-2200 characters)
 *                 minLength: 1
 *                 maxLength: 2200
 *                 example: Check out this amazing video! 🎬✨
 *               hashtags:
 *                 type: array
 *                 items:
 *                   type: string
 *                   maxLength: 30
 *                 maxItems: 30
 *                 description: Optional hashtags (max 30 items, each max 30 chars)
 *                 example: ["#video", "#content", "#amazing"]
 *               platforms:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - accountId
 *                   properties:
 *                     name:
 *                       type: string
 *                       enum: [instagram, tiktok, youtube, facebook, twitter, linkedin]
 *                       description: Platform name
 *                     accountId:
 *                       type: string
 *                       description: Platform account ID from Bundle.social
 *                     type:
 *                       type: string
 *                       enum: [SHORT, VIDEO]
 *                       description: "YouTube-specific: Video type (SHORT for vertical videos ≤60s, VIDEO for regular uploads). Only used when name is 'youtube'. Optional - defaults to SHORT for videos ≤60s, VIDEO otherwise"
 *                       example: SHORT
 *                 example:
 *                   - name: instagram
 *                     accountId: bundle_account_123
 *                   - name: youtube
 *                     accountId: bundle_account_789
 *                     type: SHORT
 *                   - name: twitter
 *                     accountId: bundle_account_456
 *               settings:
 *                 type: object
 *                 description: Optional post settings
 *                 properties:
 *                   autoPublish:
 *                     type: boolean
 *                     description: Auto-publish the post
 *                     example: true
 *                   allowComments:
 *                     type: boolean
 *                     description: Allow comments on the post
 *                     example: true
 *                   allowLikes:
 *                     type: boolean
 *                     description: Allow likes on the post
 *                     example: true
 *                   visibility:
 *                     type: string
 *                     enum: [public, private, unlisted]
 *                     description: Post visibility
 *                     example: public
 *     responses:
 *       201:
 *         description: Post created successfully
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
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Immediate post creation (publish right now using past date in Bundle.social)
router.post('/create', ensureBundleSetup, validate(postCreateSchema), newPostController.createImmediatePost);

/**
 * @swagger
 * /api/v1/posts/schedule:
 *   post:
 *     summary: Schedule a post for later publication
 *     tags: [Posts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoId
 *               - caption
 *               - platforms
 *               - scheduledFor
 *             properties:
 *               videoId:
 *                 type: string
 *                 description: Associated video ID (required)
 *                 example: 60f1b1b1b1b1b1b1b1b1b1b1
 *               caption:
 *                 type: string
 *                 description: Post caption/content (1-2200 characters)
 *                 minLength: 1
 *                 maxLength: 2200
 *                 example: Check out this amazing video! 🎬✨
 *               platforms:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - accountId
 *                   properties:
 *                     name:
 *                       type: string
 *                       enum: [instagram, tiktok, youtube, facebook, twitter, linkedin]
 *                       description: Platform name
 *                     accountId:
 *                       type: string
 *                       description: Platform account ID from Bundle.social
 *                     type:
 *                       type: string
 *                       enum: [SHORT, VIDEO]
 *                       description: "YouTube-specific: Video type (SHORT for vertical videos ≤60s, VIDEO for regular uploads). Only used when name is 'youtube'. Optional - defaults to SHORT for videos ≤60s, VIDEO otherwise"
 *                       example: VIDEO
 *                 example:
 *                   - name: instagram
 *                     accountId: bundle_account_123
 *                   - name: youtube
 *                     accountId: bundle_account_789
 *                     type: VIDEO
 *                   - name: twitter
 *                     accountId: bundle_account_456
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *                 description: When to publish the post (must be in the future)
 *                 example: "2024-01-15T14:30:00Z"
 *               hashtags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["#video", "#content", "#amazing"]
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["@friend", "@collaborator"]
 *     responses:
 *       201:
 *         description: Post scheduled successfully via Bundle.social
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
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *                     bundleSocialPostId:
 *                       type: string
 *                       description: Bundle.social post identifier
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Bundle.social scheduling error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Scheduled post creation (publish at future date)
router.post('/schedule', ensureBundleSetup, validate(postScheduleSchema), newPostController.createScheduledPost);

/**
 * @swagger
 * /api/v1/posts/user/{id}:
 *   get:
 *     summary: Get posts by user ID
 *     tags: [Posts]
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
 *         description: Number of posts per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, published, failed]
 *         description: Filter by post status
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [facebook, instagram, twitter, linkedin, tiktok, youtube]
 *         description: Filter by platform
 *     responses:
 *       200:
 *         description: User posts retrieved successfully
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
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
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
router.get('/user/:id', validateQuery(paginationSchema), postController.getUserPosts);

// Posts summary/analytics
router.get('/summary', postController.getPostsSummary);

// Post-specific routes
router
  .route('/:id')
  .get(postController.getPost)
  .patch(postController.updatePost)
  .delete(postController.deletePost);

// Post actions
router.post('/:id/publish', postController.publishPost);

/**
 * @swagger
 * /api/v1/posts/{id}/sync:
 *   post:
 *     summary: Sync post status with Bundle.social
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID to sync
 *     responses:
 *       200:
 *         description: Post status synced successfully
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
 *                   example: Post status synced successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     post:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         bundleStatus:
 *                           type: string
 *                           enum: [draft, scheduled, posted, error, deleted, processing]
 *                         publishedAt:
 *                           type: string
 *                           format: date-time
 *                         bundleError:
 *                           type: string
 *                         bundleErrors:
 *                           type: object
 *                         bundleExternalData:
 *                           type: object
 *                     changes:
 *                       type: object
 *                       properties:
 *                         statusChanged:
 *                           type: boolean
 *                         oldStatus:
 *                           type: string
 *                         newStatus:
 *                           type: string
 *       400:
 *         description: Post is not linked to Bundle.social
 *       404:
 *         description: Post not found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/sync', postController.syncPostStatus);

// Post analytics
router.get('/:id/analytics', postController.getPostAnalytics);

module.exports = router;