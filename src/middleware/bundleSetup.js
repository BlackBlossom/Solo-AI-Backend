const organizationService = require('../services/organizationService');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

/**
 * Middleware to ensure user has Bundle.social setup before accessing protected features
 * If not set up, it will automatically create the Bundle.social organization and team
 */
const ensureBundleSetup = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Check if Bundle.social is already set up
    if (user.bundleRegistered && user.bundleTeamId && user.bundleOrganizationId) {
      // Already set up, continue
      req.user.bundleTeamId = user.bundleTeamId;
      req.user.bundleOrganizationId = user.bundleOrganizationId;
      return next();
    }

    // Bundle.social not set up yet - create it now
    logger.info('Setting up Bundle.social for user on-demand:', { userId: user._id });

    try {
      const orgData = await organizationService.setupUserOrganization({
        name: user.name,
        email: user.email,
        _id: user._id
      });

      // Update user with Bundle.social details
      user.bundleOrganizationId = orgData.bundleOrganizationId;
      user.bundleTeamId = orgData.bundleTeamId;
      user.bundleRegistered = true;
      await user.save({ validateBeforeSave: false });

      // Update request user object
      req.user.bundleTeamId = user.bundleTeamId;
      req.user.bundleOrganizationId = user.bundleOrganizationId;
      req.user.bundleRegistered = true;

      logger.info('Bundle.social setup completed on-demand:', {
        userId: user._id,
        teamId: user.bundleTeamId
      });

      return next();
    } catch (bundleError) {
      logger.error('Failed to setup Bundle.social on-demand:', {
        userId: user._id,
        error: bundleError.message
      });
      return sendError(res, 500, 'Failed to set up Bundle.social integration. Please try again later.');
    }
  } catch (error) {
    logger.error('Error in ensureBundleSetup middleware:', error);
    return sendError(res, 500, 'Internal server error');
  }
};

/**
 * Check if user has Bundle.social setup (doesn't create it)
 * Returns setup status in response
 */
const checkBundleSetup = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    req.bundleSetupStatus = {
      isSetup: user.bundleRegistered && !!user.bundleTeamId && !!user.bundleOrganizationId,
      bundleTeamId: user.bundleTeamId || null,
      bundleOrganizationId: user.bundleOrganizationId || null
    };

    next();
  } catch (error) {
    logger.error('Error checking Bundle.social setup:', error);
    return sendError(res, 500, 'Internal server error');
  }
};

module.exports = {
  ensureBundleSetup,
  checkBundleSetup
};
