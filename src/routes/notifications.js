const express = require('express');
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const {
  validateDeviceToken,
  validateRemoveToken
} = require('../middleware/notificationValidation');

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: User device token management for push notifications
 */

/**
 * @swagger
 * /api/v1/notifications/device-token:
 *   post:
 *     summary: Register or update FCM device token
 *     description: Register a new device token or update existing one for receiving push notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - platform
 *             properties:
 *               token:
 *                 type: string
 *                 description: FCM device token from Firebase SDK
 *                 example: "dXJ4K9xR3kY:APA91bH..."
 *               deviceId:
 *                 type: string
 *                 description: Unique device identifier (optional)
 *                 example: "device_12345"
 *               platform:
 *                 type: string
 *                 enum: [android, ios, web]
 *                 description: Device platform
 *                 example: "android"
 *     responses:
 *       200:
 *         description: Device token registered successfully
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
 *                   example: Device token registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokenCount:
 *                       type: integer
 *                       example: 2
 *                     platform:
 *                       type: string
 *                       example: android
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/device-token', validateDeviceToken, notificationController.registerDeviceToken);

/**
 * @swagger
 * /api/v1/notifications/device-token:
 *   delete:
 *     summary: Remove FCM device token
 *     description: Remove a device token from user's account (e.g., on app logout)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: FCM device token to remove
 *                 example: "dXJ4K9xR3kY:APA91bH..."
 *     responses:
 *       200:
 *         description: Device token removed successfully
 *       400:
 *         description: Invalid input or token not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/device-token', validateRemoveToken, notificationController.removeDeviceToken);

/**
 * @swagger
 * /api/v1/notifications/device-tokens:
 *   get:
 *     summary: Get registered device tokens
 *     description: Retrieve list of all device tokens registered for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device tokens retrieved successfully
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
 *                   example: Device tokens retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           deviceId:
 *                             type: string
 *                           platform:
 *                             type: string
 *                           tokenPreview:
 *                             type: string
 *                             example: "dXJ4K9xR3kY:APA91bH..."
 *                           addedAt:
 *                             type: string
 *                             format: date-time
 *                           lastUsed:
 *                             type: string
 *                             format: date-time
 *                     count:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/device-tokens', notificationController.getDeviceTokens);

/**
 * @swagger
 * /api/v1/notifications/device-tokens/clear:
 *   delete:
 *     summary: Clear all device tokens
 *     description: Remove all device tokens for the authenticated user (logout from all devices)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All device tokens cleared successfully
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
 *                   example: All device tokens cleared successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     removedCount:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: Unauthorized
 */
router.delete('/device-tokens/clear', notificationController.clearAllDeviceTokens);

module.exports = router;
