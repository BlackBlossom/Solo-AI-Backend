const express = require('express');
const socialController = require('../controllers/socialController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { socialAccountConnectSchema } = require('../utils/validation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Social
 *   description: Social media account management with Bundle.social integration
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/social/accounts:
 *   get:
 *     summary: Get all connected social media accounts
 *     tags: [Social]
 *     responses:
 *       200:
 *         description: Connected accounts retrieved successfully
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
 *                     accounts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SocialAccount'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/accounts', socialController.getConnectedAccounts);

/**
 * @swagger
 * /api/v1/social/connect:
 *   post:
 *     summary: Connect a new social media account via Bundle.social
 *     tags: [Social]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [facebook, instagram, twitter, linkedin, tiktok, youtube]
 *                 example: instagram
 *               settings:
 *                 type: object
 *                 properties:
 *                   autoPost:
 *                     type: boolean
 *                     default: false
 *                   defaultHashtags:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Portal link created for account connection
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
 *                     portalLink:
 *                       type: string
 *                       description: Bundle.social portal link for account connection
 *                       example: https://app.bundle.social/portal/connect?token=abc123
 *                     expires:
 *                       type: string
 *                       format: date-time
 *                       description: When the portal link expires
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Account already connected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/connect', validate(socialAccountConnectSchema), socialController.connectAccount);

/**
 * @swagger
 * /api/v1/social/accounts/{accountId}:
 *   get:
 *     summary: Get social account details
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Social account ID
 *     responses:
 *       200:
 *         description: Account details retrieved successfully
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
 *                       $ref: '#/components/schemas/SocialAccount'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   patch:
 *     summary: Update social account settings
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Social account ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *                 properties:
 *                   autoPost:
 *                     type: boolean
 *                   defaultHashtags:
 *                     type: array
 *                     items:
 *                       type: string
 *                   postingSchedule:
 *                     type: object
 *     responses:
 *       200:
 *         description: Account settings updated successfully
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
 *                       $ref: '#/components/schemas/SocialAccount'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Disconnect social media account
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Social account ID
 *     responses:
 *       200:
 *         description: Account disconnected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router
  .route('/accounts/:accountId')
  .get(socialController.getAccountDetails)
  .patch(socialController.updateAccountSettings)
  .delete(socialController.disconnectAccount);

/**
 * @swagger
 * /api/v1/social/accounts/{accountId}/refresh:
 *   post:
 *     summary: Refresh social account data from Bundle.social
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Social account ID
 *     responses:
 *       200:
 *         description: Account data refreshed successfully
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
 *                       $ref: '#/components/schemas/SocialAccount'
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
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
router.post('/accounts/:accountId/refresh', socialController.refreshAccountData);

module.exports = router;