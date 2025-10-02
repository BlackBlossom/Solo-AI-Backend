const SocialAccount = require('../models/SocialAccount');
const User = require('../models/User');
const bundleSocialService = require('../services/bundleSocialService');
const { 
  sendSuccess, 
  sendCreated, 
  sendBadRequest, 
  sendNotFound 
} = require('../utils/response');
const logger = require('../utils/logger');

// Connect social media account - using Bundle.social portal-link approach
const connectAccount = async (req, res, next) => {
  try {
    const { socialAccountTypes, redirectUrl, userName } = req.body;

    // Create portal link via Bundle.social
    const portalLink = await bundleSocialService.createPortalLink({
      teamId: req.user.bundleTeamId,
      socialAccountTypes: socialAccountTypes || ["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "TWITTER", "LINKEDIN"],
      redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/social/callback`,
      userName: userName || req.user.name
    });

    logger.info('Portal link created for social account connection:', {
      userId: req.user.id,
      teamId: req.user.bundleTeamId,
      url: portalLink.url
    });

    sendSuccess(res, 'Portal link created successfully', {
      url: portalLink.url,
      redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/social/callback`
    });
  } catch (error) {
    logger.error('Connect social account error:', error);
    next(error);
  }
};

// Disconnect social media account
const disconnectAccount = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const socialAccount = await SocialAccount.findOne({
      _id: accountId,
      user: req.user.id
    });

    if (!socialAccount) {
      return sendNotFound(res, 'Social account not found');
    }

    // Disconnect from Bundle.social
    try {
      await bundleSocialService.disconnectSocialAccount({
        teamId: req.user.bundleTeamId,
        socialAccountId: socialAccount.bundleAccountId
      });
    } catch (bundleError) {
      logger.warn('Failed to disconnect from Bundle.social:', bundleError.message);
    }

    // Update account status
    socialAccount.isConnected = false;
    socialAccount.isActive = false;
    await socialAccount.save();

    logger.info('Social account disconnected:', {
      userId: req.user.id,
      platform: socialAccount.platform,
      accountId: socialAccount._id
    });

    sendSuccess(res, 'Account disconnected successfully');
  } catch (error) {
    logger.error('Disconnect social account error:', error);
    next(error);
  }
};

// Get connected social accounts - Direct Bundle.social integration
const getConnectedAccounts = async (req, res, next) => {
  try {
    // Check if user has Bundle.social team ID
    if (!req.user.bundleTeamId) {
      logger.warn('User does not have Bundle.social team ID:', req.user.id);
      // Fallback to local database only
      const localAccounts = await SocialAccount.find({
        user: req.user.id,
        isConnected: true
      });

      return sendSuccess(res, 'Connected accounts retrieved successfully', {
        accounts: localAccounts,
        totalConnected: localAccounts.length,
        source: 'local'
      });
    }

    // Fetch accounts directly from Bundle.social using teamId
    const bundleAccounts = await bundleSocialService.getSocialAccounts(req.user.bundleTeamId);
    
    logger.info('Bundle.social accounts fetched:', { 
      teamId: req.user.bundleTeamId, 
      accountCount: bundleAccounts ? bundleAccounts.length : 0,
      rawData: JSON.stringify(bundleAccounts, null, 2)
    });

    // Handle case where no accounts are returned
    if (!bundleAccounts || !Array.isArray(bundleAccounts)) {
      logger.warn('No social accounts found or invalid response from Bundle.social');
      // Fallback to local database
      const localAccounts = await SocialAccount.find({
        user: req.user.id,
        isConnected: true
      });

      return sendSuccess(res, 'Connected accounts retrieved successfully', {
        accounts: localAccounts,
        totalConnected: localAccounts.length,
        source: 'local-fallback'
      });
    }

    // Sync with local database
    const syncedAccounts = [];
    
    for (const bundleAccount of bundleAccounts) {
      if (!bundleAccount || !bundleAccount.id) {
        logger.warn('Invalid bundle account data:', bundleAccount);
        continue;
      }

      logger.info('Processing bundle account:', {
        id: bundleAccount.id,
        platform: bundleAccount.platform,
        type: bundleAccount.type,
        socialAccountType: bundleAccount.socialAccountType,
        allKeys: Object.keys(bundleAccount || {})
      });

      let localAccount = await SocialAccount.findOne({
        user: req.user.id,
        bundleAccountId: bundleAccount.id
      });

      if (!localAccount) {
        // Create new local account record
        // Determine platform name safely
        let platformName = 'unknown';
        try {
          if (bundleAccount.platform && typeof bundleAccount.platform === 'string') {
            platformName = bundleAccount.platform.toLowerCase();
          } else if (bundleAccount.type && typeof bundleAccount.type === 'string') {
            platformName = bundleAccount.type.toLowerCase();
          } else if (bundleAccount.socialAccountType && typeof bundleAccount.socialAccountType === 'string') {
            platformName = bundleAccount.socialAccountType.toLowerCase();
          }
        } catch (err) {
          logger.warn('Error determining platform name:', err.message, bundleAccount);
        }

        localAccount = await SocialAccount.create({
          user: req.user.id,
          platform: platformName,
          platformAccountId: bundleAccount.platformAccountId || bundleAccount.id,
          platformUsername: bundleAccount.username || bundleAccount.platformUsername || bundleAccount.userUsername || bundleAccount.handle || `${platformName}_user_${Date.now()}`,
          platformDisplayName: bundleAccount.displayName || bundleAccount.userDisplayName || bundleAccount.name || bundleAccount.username || 'Unknown User',
          bundleAccountId: bundleAccount.id,
          isConnected: true,
          connectedAt: new Date(),
          metadata: {
            profilePicture: bundleAccount.profilePicture || bundleAccount.avatarUrl,
            followerCount: bundleAccount.followerCount || 0,
            followingCount: bundleAccount.followingCount || 0,
            postCount: bundleAccount.postCount || 0,
            isVerified: bundleAccount.isVerified || false,
            businessAccount: bundleAccount.businessAccount || false
          }
        });
      } else {
        // Update existing account
        localAccount.platformUsername = bundleAccount.username || bundleAccount.platformUsername || bundleAccount.userUsername || bundleAccount.handle || localAccount.platformUsername;
        localAccount.platformDisplayName = bundleAccount.displayName || bundleAccount.userDisplayName || bundleAccount.name || bundleAccount.username || localAccount.platformDisplayName;
        localAccount.isConnected = true;
        localAccount.metadata = {
          profilePicture: bundleAccount.profilePicture,
          followerCount: bundleAccount.followerCount,
          followingCount: bundleAccount.followingCount,
          postCount: bundleAccount.postCount,
          isVerified: bundleAccount.isVerified,
          businessAccount: bundleAccount.businessAccount
        };
        localAccount.lastSyncAt = new Date();
        await localAccount.save();
      }

      syncedAccounts.push(localAccount);
    }

    // Update user's socialAccounts array in User model
    const user = await User.findById(req.user.id);
    user.socialAccounts = syncedAccounts.map(account => ({
      socialAccountId: account.bundleAccountId,
      platform: account.platform.toUpperCase(),
      username: account.platformUsername,
      displayName: account.platformDisplayName,
      profilePicture: account.metadata.profilePicture
    }));
    await user.save();

    sendSuccess(res, 'Connected accounts retrieved', {
      accounts: syncedAccounts
    });
  } catch (error) {
    logger.error('Get connected accounts error:', error);
    next(error);
  }
};

// Get social account details
const getAccountDetails = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await SocialAccount.findOne({
      _id: accountId,
      user: req.user.id
    });

    if (!account) {
      return sendNotFound(res, 'Social account not found');
    }

    sendSuccess(res, 'Account details retrieved', { account });
  } catch (error) {
    logger.error('Get account details error:', error);
    next(error);
  }
};

// Update social account settings
const updateAccountSettings = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { settings } = req.body;

    const account = await SocialAccount.findOne({
      _id: accountId,
      user: req.user.id
    });

    if (!account) {
      return sendNotFound(res, 'Social account not found');
    }

    account.settings = { ...account.settings, ...settings };
    await account.save();

    logger.info('Social account settings updated:', {
      userId: req.user.id,
      accountId: account._id
    });

    sendSuccess(res, 'Account settings updated', {
      settings: account.settings
    });
  } catch (error) {
    logger.error('Update account settings error:', error);
    next(error);
  }
};

// Get platform authentication URL
const getAuthUrl = async (req, res, next) => {
  try {
    const { platform } = req.params;
    const { redirectUri } = req.query;

    // In a real implementation, you would get the OAuth URL from Bundle.social
    // For MVP, we'll return a placeholder
    const authUrl = `https://api.bundle.social/auth/${platform}?team_id=${req.user.bundleTeamId}&redirect_uri=${redirectUri}`;

    sendSuccess(res, 'Authentication URL generated', {
      authUrl,
      platform
    });
  } catch (error) {
    logger.error('Get auth URL error:', error);
    next(error);
  }
};

// Refresh account data
const refreshAccountData = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await SocialAccount.findOne({
      _id: accountId,
      user: req.user.id
    });

    if (!account) {
      return sendNotFound(res, 'Social account not found');
    }

    // Fetch latest data from Bundle.social
    const bundleAccounts = await bundleSocialService.getSocialAccounts(req.user.bundleTeamId);
    const bundleAccount = bundleAccounts.find(ba => ba.id === account.bundleAccountId);

    if (!bundleAccount) {
      return sendNotFound(res, 'Account not found in Bundle.social');
    }

    // Update account data
    account.platformUsername = bundleAccount.username;
    account.platformDisplayName = bundleAccount.displayName;
    account.metadata = {
      profilePicture: bundleAccount.profilePicture,
      followerCount: bundleAccount.followerCount,
      followingCount: bundleAccount.followingCount,
      postCount: bundleAccount.postCount,
      isVerified: bundleAccount.isVerified,
      businessAccount: bundleAccount.businessAccount
    };
    account.lastSyncAt = new Date();

    await account.save();

    logger.info('Account data refreshed:', {
      userId: req.user.id,
      accountId: account._id
    });

    sendSuccess(res, 'Account data refreshed', { account });
  } catch (error) {
    logger.error('Refresh account data error:', error);
    next(error);
  }
};

module.exports = {
  connectAccount,
  disconnectAccount,
  getConnectedAccounts,
  getAccountDetails,
  updateAccountSettings,
  getAuthUrl,
  refreshAccountData
};