const express = require('express');
const postController = require('../controllers/postController');
const { protect } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validation');
const { postCreateSchema, paginationSchema } = require('../utils/validation');

const router = express.Router();

/**
 * @swagger
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
 *     summary: Create a new post draft
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
 *                 example:
 *                   - name: instagram
 *                     accountId: bundle_account_123
 *                   - name: twitter
 *                     accountId: bundle_account_456
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *                 description: Optional scheduled publish time (must be in the future)
 *                 example: 2024-12-25T10:00:00Z
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
router.post('/create', validate(postCreateSchema), postController.createPost);

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
 *               - content
 *               - platforms
 *               - scheduledTime
 *             properties:
 *               content:
 *                 type: string
 *                 description: Post content/caption
 *                 example: Check out this amazing video! 🎬✨
 *               videoId:
 *                 type: string
 *                 description: Associated video ID
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [facebook, instagram, twitter, linkedin, tiktok, youtube]
 *                 example: ["instagram", "twitter"]
 *               scheduledTime:
 *                 type: string
 *                 format: date-time
 *                 description: When to publish the post
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
router.post('/schedule', validate(postCreateSchema), postController.schedulePost);

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

// Post analytics
router.get('/:id/analytics', postController.getPostAnalytics);

module.exports = router;