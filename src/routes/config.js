const express = require('express');
const Settings = require('../models/Settings');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: App Config
 *   description: Public app configuration endpoints
 */

/**
 * @swagger
 * /api/v1/config/app:
 *   get:
 *     summary: Get public app configuration
 *     description: Retrieve non-sensitive app configuration including support emails, app name, etc.
 *     tags: [App Config]
 *     responses:
 *       200:
 *         description: App configuration retrieved successfully
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
 *                     config:
 *                       type: object
 *                       properties:
 *                         appName:
 *                           type: string
 *                           example: Solo AI
 *                         description:
 *                           type: string
 *                           example: AI-powered video editing platform
 *                         supportEmail:
 *                           type: string
 *                           example: support@soloai.app
 *                         reportProblemEmail:
 *                           type: string
 *                           example: support@soloai.app
 *                         maintenanceMode:
 *                           type: boolean
 *                           example: false
 *                         allowNewRegistrations:
 *                           type: boolean
 *                           example: true
 *                         features:
 *                           type: object
 *                           properties:
 *                             videoEditingEnabled:
 *                               type: boolean
 *                             socialMediaIntegrationEnabled:
 *                               type: boolean
 *                             aiAssistantEnabled:
 *                               type: boolean
 *       500:
 *         description: Server error
 */
router.get('/app', async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    const config = {
      appName: settings.app.name,
      description: settings.app.description,
      supportEmail: settings.app.supportEmail,
      reportProblemEmail: settings.app.reportProblemEmail,
      maintenanceMode: settings.app.maintenanceMode,
      allowNewRegistrations: settings.app.allowNewRegistrations,
      features: {
        videoEditingEnabled: settings.features.videoEditingEnabled,
        socialMediaIntegrationEnabled: settings.features.socialMediaIntegrationEnabled,
        aiAssistantEnabled: settings.features.aiAssistantEnabled,
      }
    };

    return sendSuccess(res, { config });
  } catch (error) {
    logger.error('Error fetching app config:', error);
    return sendError(res, 'Failed to retrieve app configuration');
  }
});

/**
 * @swagger
 * /api/v1/config/contact:
 *   get:
 *     summary: Get contact information
 *     description: Retrieve contact email addresses for support and reporting problems
 *     tags: [App Config]
 *     responses:
 *       200:
 *         description: Contact information retrieved successfully
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
 *                     contact:
 *                       type: object
 *                       properties:
 *                         supportEmail:
 *                           type: string
 *                           example: support@soloai.app
 *                         reportProblemEmail:
 *                           type: string
 *                           example: support@soloai.app
 *       500:
 *         description: Server error
 */
router.get('/contact', async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    const contact = {
      supportEmail: settings.app.supportEmail,
      reportProblemEmail: settings.app.reportProblemEmail,
    };

    return sendSuccess(res, { contact });
  } catch (error) {
    logger.error('Error fetching contact info:', error);
    return sendError(res, 'Failed to retrieve contact information');
  }
});

module.exports = router;
