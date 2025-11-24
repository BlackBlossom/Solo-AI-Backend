const express = require('express');
const inspirationController = require('../controllers/inspirationController');
const { protect } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validation');
const { inspirationSearchSchema, subredditSchema } = require('../utils/validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Inspiration
 *   description: Reddit and Google Trends-based inspiration discovery API
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/inspiration/search:
 *   get:
 *     summary: Search for inspiration on any topic (Reddit only)
 *     description: |
 *       Search for trending content from Reddit.
 *       Results are cached for 24 hours to improve performance.
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: topic
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *         description: Topic to search for
 *         example: "artificial intelligence"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 25
 *         description: Number of Reddit posts to fetch
 *     responses:
 *       200:
 *         description: Inspiration data retrieved successfully
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
 *                   example: Inspiration data fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     topic:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     reddit:
 *                       type: object
 *                       properties:
 *                         posts:
 *                           type: array
 *                         totalFound:
 *                           type: number
 *                     fromCache:
 *                       type: boolean
 *       400:
 *         description: Invalid parameters
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/search', validateQuery(inspirationSearchSchema), inspirationController.searchInspiration);

/**
 * @swagger
 * /api/v1/inspiration/trending:
 *   get:
 *     summary: Get current trending topics from Reddit
 *     description: Retrieve currently trending posts from Reddit's front page
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 25
 *     responses:
 *       200:
 *         description: Trending topics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     reddit:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           subreddit:
 *                             type: string
 *                           score:
 *                             type: number
 *                           numComments:
 *                             type: number
 *                           url:
 *                             type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/trending', inspirationController.getTrendingTopics);

/**
 * @swagger
 * /api/v1/inspiration/subreddit/{subreddit}:
 *   get:
 *     summary: Get posts from specific subreddit
 *     description: Fetch hot, new, or top posts from a specific subreddit
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subreddit
 *         required: true
 *         schema:
 *           type: string
 *         description: Subreddit name (without r/)
 *         example: "technology"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 25
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [hot, new, top]
 *           default: hot
 *     responses:
 *       200:
 *         description: Subreddit posts retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/subreddit/:subreddit', validateQuery(subredditSchema), inspirationController.getSubredditPosts);

/**
 * @swagger
 * /api/v1/inspiration/trends/country/{country}:
 *   get:
 *     summary: Get trending keywords for a specific country
 *     description: |
 *       Fetch real-time trending keywords from Google Trends for a specific country.
 *       Results are cached for 1 hour to improve performance.
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: country
 *         required: true
 *         schema:
 *           type: string
 *         description: Country name (e.g., India, United States, United Kingdom)
 *         example: "India"
 *     responses:
 *       200:
 *         description: Trending keywords retrieved successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     country:
 *                       type: string
 *                     keywords:
 *                       type: array
 *                       items:
 *                         type: string
 *                     lastUpdate:
 *                       type: string
 *                     fromCache:
 *                       type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/trends/country/:country', inspirationController.getTrendingKeywordsByCountry);

/**
 * @swagger
 * /api/v1/inspiration/trends/global:
 *   get:
 *     summary: Get trending keywords for all countries (global trends)
 *     description: |
 *       Fetch real-time trending keywords from Google Trends for all available countries.
 *       Results are cached for 1 hour to improve performance.
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Limit number of countries returned
 *         example: 50
 *     responses:
 *       200:
 *         description: Global trending keywords retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     countries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           country:
 *                             type: string
 *                           keywordsText:
 *                             type: array
 *                             items:
 *                               type: string
 *                           lastUpdate:
 *                             type: string
 *                     totalCountries:
 *                       type: integer
 *                     fromCache:
 *                       type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/trends/global', inspirationController.getGlobalTrends);

/**
 * @swagger
 * /api/v1/inspiration/trends/countries:
 *   get:
 *     summary: Get list of available countries
 *     description: Retrieve list of all countries available for trending keywords
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available countries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     countries:
 *                       type: array
 *                       items:
 *                         type: string
 *                     total:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/trends/countries', inspirationController.getAvailableCountries);

/**
 * @swagger
 * /api/v1/inspiration/trends/region/{region}:
 *   get:
 *     summary: Get trending keywords by region
 *     description: |
 *       Fetch trending keywords for all countries in a specific region.
 *       Available regions: Asia, Europe, Americas, Middle East, Africa, Oceania
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Asia, Europe, Americas, Middle East, Africa, Oceania]
 *         description: Region name
 *         example: "Asia"
 *     responses:
 *       200:
 *         description: Regional trending keywords retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     region:
 *                       type: string
 *                     countries:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/trends/region/:region', inspirationController.getTrendingByRegion);

module.exports = router;
