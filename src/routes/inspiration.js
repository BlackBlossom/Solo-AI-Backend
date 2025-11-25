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

// ============================================================================
// GOOGLE TRENDS HISTORICAL DATA (TRENDLY API) ROUTES
// ============================================================================

/**
 * @swagger
 * /api/v1/inspiration/google-trends/categories:
 *   get:
 *     summary: Get all Google Trends categories
 *     description: Retrieve cached list of all categories for filtering trend searches
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
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
 *                   example: Categories fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Arts & Entertainment", "Autos & Vehicles", "Beauty & Fitness", "Books & Literature", "Business & Industrial"]
 *                     total:
 *                       type: integer
 *                       example: 862
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/google-trends/categories', inspirationController.getCategories);

/**
 * @swagger
 * /api/v1/inspiration/google-trends/geographic:
 *   get:
 *     summary: Get all geographic options
 *     description: Retrieve cached list of countries and their regions for trend filtering
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Geographic options retrieved successfully
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
 *                   example: Geographic options fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     geo:
 *                       type: object
 *                       properties:
 *                         countries:
 *                           type: object
 *                           example: {"United States": {"country": "United States", "regions": ["Alabama", "Alaska", "Arizona", "California"]}, "United Kingdom": {"country": "United Kingdom", "regions": ["England", "Scotland", "Wales"]}}
 *                     countriesCount:
 *                       type: integer
 *                       example: 217
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/google-trends/geographic', inspirationController.getGeographic);

/**
 * @swagger
 * /api/v1/inspiration/google-trends/interest-over-time:
 *   post:
 *     summary: Get interest over time for keywords
 *     description: Fetch historical trend data showing search interest over time for visual graphs
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keywords
 *               - start
 *             properties:
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["React", "Vue", "Angular"]
 *                 description: Keywords to compare (up to 5)
 *               start:
 *                 type: string
 *                 example: "2024-01-01T00:00:00+0100"
 *                 description: Start date in format YYYY-MM-DDTHH:mm:ss+0100
 *               country:
 *                 type: string
 *                 example: "United States"
 *                 description: Country name from geographic options
 *               region:
 *                 type: string
 *                 example: "California"
 *                 description: Region within country (optional)
 *               category:
 *                 type: string
 *                 example: "Programming"
 *                 description: Category filter from categories list (optional)
 *               gprop:
 *                 type: string
 *                 enum: ["", "images", "news", "youtube", "froogle"]
 *                 example: ""
 *                 description: Google property filter - empty for web search
 *     responses:
 *       200:
 *         description: Interest over time data retrieved
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
 *                   example: Interest over time data retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     timeline:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: "2024-01-07"
 *                           values:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 keyword:
 *                                   type: string
 *                                   example: "React"
 *                                 value:
 *                                   type: number
 *                                   example: 87
 *                       example: [{"date": "2024-01-07", "values": [{"keyword": "React", "value": 87}, {"keyword": "Vue", "value": 45}]}]
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/google-trends/interest-over-time', inspirationController.getInterestOverTime);

/**
 * @swagger
 * /api/v1/inspiration/google-trends/interest-by-region:
 *   post:
 *     summary: Get interest by region for keywords
 *     description: Fetch geographic distribution of search interest for mapping visualizations
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keywords
 *               - start
 *             properties:
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["artificial intelligence"]
 *                 description: Keywords to analyze (up to 5)
 *               start:
 *                 type: string
 *                 example: "2024-01-01T00:00:00+0100"
 *                 description: Start date in format YYYY-MM-DDTHH:mm:ss+0100
 *               country:
 *                 type: string
 *                 example: "United States"
 *                 description: Country name from geographic options
 *               region:
 *                 type: string
 *                 example: ""
 *                 description: Specific region within country (optional)
 *               category:
 *                 type: string
 *                 example: "Computers & Electronics"
 *                 description: Category filter (optional)
 *               gprop:
 *                 type: string
 *                 example: ""
 *                 description: Google property filter (optional)
 *               resolution:
 *                 type: string
 *                 enum: ["COUNTRY", "REGION", "DMA", "CITY"]
 *                 default: "COUNTRY"
 *                 example: "REGION"
 *                 description: Geographic resolution level for data
 *               include_low_volume:
 *                 type: boolean
 *                 default: false
 *                 example: true
 *                 description: Include regions with low search volume
 *     responses:
 *       200:
 *         description: Interest by region data retrieved
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
 *                   example: Interest by region data retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     regions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           location:
 *                             type: string
 *                             example: "California"
 *                           value:
 *                             type: number
 *                             example: 100
 *                       example: [{"location": "California", "value": 100}, {"location": "New York", "value": 87}, {"location": "Texas", "value": 76}]
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/google-trends/interest-by-region', inspirationController.getInterestByRegion);

/**
 * @swagger
 * /api/v1/inspiration/google-trends/related-queries:
 *   post:
 *     summary: Get related queries for keywords
 *     description: Fetch related search queries (top and rising) to discover trending topics
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keywords
 *               - start
 *             properties:
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["video editing"]
 *                 description: Keywords to find related queries for
 *               start:
 *                 type: string
 *                 example: "2024-01-01T00:00:00+0100"
 *                 description: Start date in format YYYY-MM-DDTHH:mm:ss+0100
 *               country:
 *                 type: string
 *                 example: "United States"
 *                 description: Country filter (optional)
 *               region:
 *                 type: string
 *                 example: ""
 *                 description: Region filter (optional)
 *               category:
 *                 type: string
 *                 example: "Arts & Entertainment"
 *                 description: Category filter (optional)
 *               gprop:
 *                 type: string
 *                 example: "youtube"
 *                 description: Filter by images, news, youtube, or froogle (optional)
 *     responses:
 *       200:
 *         description: Related queries retrieved successfully
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
 *                   example: Related queries retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     top:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           query:
 *                             type: string
 *                             example: "best video editing software"
 *                           value:
 *                             type: number
 *                             example: 100
 *                       example: [{"query": "best video editing software", "value": 100}, {"query": "free video editor", "value": 85}]
 *                     rising:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           query:
 *                             type: string
 *                             example: "AI video editing"
 *                           value:
 *                             type: string
 *                             example: "+450%"
 *                       example: [{"query": "AI video editing", "value": "+450%"}, {"query": "mobile video editor", "value": "+230%"}]
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/google-trends/related-queries', inspirationController.getRelatedQueries);

/**
 * @swagger
 * /api/v1/inspiration/google-trends/related-topics:
 *   post:
 *     summary: Get related topics for a keyword
 *     description: Fetch related topics (top and rising) for trend discovery
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keywords
 *               - start
 *             properties:
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["artificial intelligence"]
 *                 description: Only first keyword is used by API
 *               start:
 *                 type: string
 *                 example: "2024-01-01T00:00:00+0100"
 *                 description: Start date in format YYYY-MM-DDTHH:mm:ss+0100
 *               country:
 *                 type: string
 *                 example: "United States"
 *                 description: Country filter (optional)
 *               region:
 *                 type: string
 *                 example: ""
 *                 description: Region filter (optional)
 *               category:
 *                 type: string
 *                 example: "Computers & Electronics"
 *                 description: Category filter (optional)
 *               gprop:
 *                 type: string
 *                 example: ""
 *                 description: Google property filter (optional)
 *     responses:
 *       200:
 *         description: Related topics retrieved successfully
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
 *                   example: Related topics retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     top:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           topic:
 *                             type: string
 *                             example: "Machine learning"
 *                           type:
 *                             type: string
 *                             example: "Topic"
 *                           value:
 *                             type: number
 *                             example: 100
 *                       example: [{"topic": "Machine learning", "type": "Topic", "value": 100}, {"topic": "ChatGPT", "type": "Search term", "value": 92}]
 *                     rising:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           topic:
 *                             type: string
 *                             example: "Gemini AI"
 *                           type:
 *                             type: string
 *                             example: "Search term"
 *                           value:
 *                             type: string
 *                             example: "+320%"
 *                       example: [{"topic": "Gemini AI", "type": "Search term", "value": "+320%"}, {"topic": "AI Ethics", "type": "Topic", "value": "+180%"}]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/google-trends/related-topics', inspirationController.getRelatedTopics);

/**
 * @swagger
 * /api/v1/inspiration/google-trends/realtime:
 *   post:
 *     summary: Get realtime trending searches
 *     description: Fetch current trending searches from Google Trends
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               country:
 *                 type: string
 *                 example: "United States"
 *                 description: Country name from geographic options
 *               category:
 *                 type: string
 *                 example: "All categories"
 *                 description: Category filter from categories list
 *     responses:
 *       200:
 *         description: Realtime searches retrieved successfully
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
 *                   example: Realtime searches retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                             example: "Apple Vision Pro Launch"
 *                           traffic:
 *                             type: string
 *                             example: "500K+"
 *                           articles:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 title:
 *                                   type: string
 *                                   example: "Apple Vision Pro Available Now"
 *                                 source:
 *                                   type: string
 *                                   example: "TechCrunch"
 *                                 time:
 *                                   type: string
 *                                   example: "2 hours ago"
 *                       example: [{"title": "Apple Vision Pro Launch", "traffic": "500K+", "articles": [{"title": "Apple Vision Pro Available Now", "source": "TechCrunch", "time": "2 hours ago"}]}]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/google-trends/realtime', inspirationController.getRealtimeSearches);

/**
 * @swagger
 * /api/v1/inspiration/google-trends/today:
 *   post:
 *     summary: Get today's top searches
 *     description: Fetch today's top trending searches
 *     tags: [Inspiration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               country:
 *                 type: string
 *                 example: "United States"
 *                 description: Country name from geographic options
 *               category:
 *                 type: string
 *                 example: "All categories"
 *                 description: Category filter from categories list
 *     responses:
 *       200:
 *         description: Today searches retrieved successfully
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
 *                   example: Today searches retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     searches:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                             example: "Tesla Cybertruck"
 *                           searches:
 *                             type: string
 *                             example: "200K+"
 *                           description:
 *                             type: string
 *                             example: "New electric vehicle delivery begins"
 *                           image:
 *                             type: string
 *                             example: "https://..."
 *                       example: [{"title": "Tesla Cybertruck", "searches": "200K+", "description": "New electric vehicle delivery begins", "image": "https://example.com/image.jpg"}]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/google-trends/today', inspirationController.getTodaySearches);

module.exports = router;
