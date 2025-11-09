const express = require('express');
const legalController = require('../controllers/legalController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Legal
 *   description: Legal content management (Privacy Policy, Terms of Use, FAQ)
 */

/**
 * @swagger
 * /api/v1/legal/links:
 *   get:
 *     summary: Get all legal content links
 *     description: Retrieve links to all published legal documents for display in app
 *     tags: [Legal]
 *     responses:
 *       200:
 *         description: Legal links retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     links:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [privacy_policy, terms_of_use, faq]
 *                           title:
 *                             type: string
 *                           url:
 *                             type: string
 *                             description: URL for web view rendering
 *                           apiUrl:
 *                             type: string
 *                             description: URL for JSON API response
 *                           lastUpdated:
 *                             type: string
 *                             format: date-time
 *                           version:
 *                             type: number
 */
router.get('/links', legalController.getLegalLinks);

/**
 * @swagger
 * /api/v1/legal/{type}:
 *   get:
 *     summary: Get legal content by type (JSON)
 *     description: Retrieve legal content in JSON format for programmatic access
 *     tags: [Legal]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [privacy_policy, terms_of_use, faq]
 *         description: Type of legal content
 *     responses:
 *       200:
 *         description: Legal content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                         title:
 *                           type: string
 *                         content:
 *                           type: string
 *                         htmlContent:
 *                           type: string
 *                         version:
 *                           type: number
 *                         isPublished:
 *                           type: boolean
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       404:
 *         description: Legal content not found
 */
router.get('/:type', legalController.getLegalContent);

/**
 * @swagger
 * /api/v1/legal/{type}/view:
 *   get:
 *     summary: Get legal content as HTML web view
 *     description: Render legal content as a fully styled HTML page for web view display
 *     tags: [Legal]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [privacy_policy, terms_of_use, faq]
 *         description: Type of legal content
 *     responses:
 *       200:
 *         description: HTML page rendered successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Legal content not found
 */
router.get('/:type/view', legalController.getLegalContentView);

module.exports = router;
