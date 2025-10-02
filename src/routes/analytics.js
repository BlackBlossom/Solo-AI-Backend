const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Social media analytics and insights via Bundle.social integration
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/analytics/account/{socialAccountId}:
 *   get:
 *     summary: Get analytics for a specific social media account
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: socialAccountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Social media account ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Analytics time period
 *       - in: query
 *         name: metrics
 *         schema:
 *           type: string
 *           example: "followers,engagement,reach"
 *         description: Comma-separated list of metrics to include
 *     responses:
 *       200:
 *         description: Account analytics retrieved successfully
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
 *                     account:
 *                       type: object
 *                       properties:
 *                         platform:
 *                           type: string
 *                           example: instagram
 *                         username:
 *                           type: string
 *                           example: "@username"
 *                     period:
 *                       type: string
 *                       example: "30d"
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         followers:
 *                           type: object
 *                           properties:
 *                             current:
 *                               type: number
 *                               example: 15420
 *                             change:
 *                               type: number
 *                               example: 340
 *                             changePercent:
 *                               type: number
 *                               example: 2.25
 *                         engagement:
 *                           type: object
 *                           properties:
 *                             likes:
 *                               type: number
 *                               example: 2450
 *                             comments:
 *                               type: number
 *                               example: 186
 *                             shares:
 *                               type: number
 *                               example: 92
 *                             rate:
 *                               type: number
 *                               example: 4.8
 *                         reach:
 *                           type: object
 *                           properties:
 *                             impressions:
 *                               type: number
 *                               example: 45320
 *                             uniqueReach:
 *                               type: number
 *                               example: 32450
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Bundle.social API error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/account/:socialAccountId', analyticsController.getAccountAnalytics);

/**
 * @swagger
 * /api/v1/analytics/post/{postId}:
 *   get:
 *     summary: Get analytics for a specific post
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *       - in: query
 *         name: detailed
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include detailed breakdown by platform
 *     responses:
 *       200:
 *         description: Post analytics retrieved successfully
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
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         content:
 *                           type: string
 *                         platforms:
 *                           type: array
 *                           items:
 *                             type: string
 *                         publishedAt:
 *                           type: string
 *                           format: date-time
 *                     analytics:
 *                       type: object
 *                       properties:
 *                         totalViews:
 *                           type: number
 *                           example: 3420
 *                         totalLikes:
 *                           type: number
 *                           example: 298
 *                         totalComments:
 *                           type: number
 *                           example: 42
 *                         totalShares:
 *                           type: number
 *                           example: 18
 *                         engagement:
 *                           type: object
 *                           properties:
 *                             rate:
 *                               type: number
 *                               example: 10.5
 *                             score:
 *                               type: number
 *                               example: 8.7
 *                         platformBreakdown:
 *                           type: object
 *                           description: Analytics by platform (when detailed=true)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/post/:postId', analyticsController.getPostAnalytics);

/**
 * @swagger
 * /api/v1/analytics/user/summary:
 *   get:
 *     summary: Get user's analytics summary across all accounts
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Analytics time period
 *     responses:
 *       200:
 *         description: User analytics summary retrieved successfully
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
 *                     period:
 *                       type: string
 *                       example: "30d"
 *                     totalAccounts:
 *                       type: number
 *                       example: 4
 *                     totalPosts:
 *                       type: number
 *                       example: 28
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalFollowers:
 *                           type: number
 *                           example: 45620
 *                         totalEngagement:
 *                           type: number
 *                           example: 3420
 *                         avgEngagementRate:
 *                           type: number
 *                           example: 7.5
 *                         totalReach:
 *                           type: number
 *                           example: 125340
 *                     byPlatform:
 *                       type: object
 *                       properties:
 *                         instagram:
 *                           type: object
 *                           properties:
 *                             followers:
 *                               type: number
 *                             posts:
 *                               type: number
 *                             engagement:
 *                               type: number
 *                         twitter:
 *                           type: object
 *                           properties:
 *                             followers:
 *                               type: number
 *                             posts:
 *                               type: number
 *                             engagement:
 *                               type: number
 *                     topPerformingPosts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           postId:
 *                             type: string
 *                           platform:
 *                             type: string
 *                           engagement:
 *                             type: number
 *                           content:
 *                             type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/user/summary', analyticsController.getUserAnalyticsSummary);

module.exports = router;