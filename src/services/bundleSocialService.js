const { bundleSocialAPI, bundleSocialConfig } = require('../config/bundleSocial');
const FormData = require('form-data');
const logger = require('../utils/logger');

class BundleSocialService {
  constructor() {
    this.api = bundleSocialAPI;
  }

  // Create a new team for user
  async createTeam(userData) {
    try {
      const response = await this.api.post('/team/', {
        name: `${userData.name}'s Team`,
        avatarUrl: userData.profilePicture || undefined
      });

      logger.info('Bundle.social team created:', { teamId: response.data.id, userId: userData._id });
      return response.data;
    } catch (error) {
      logger.error('Failed to create Bundle.social team:', error.response?.data || error.message);
      throw new Error('Failed to create social media team');
    }
  }

  // Get team details
  async getTeam(teamId) {
    try {
      const response = await this.api.get(`/team/${teamId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Bundle.social team:', error.response?.data || error.message);
      throw new Error('Failed to retrieve team information');
    }
  }

  // Create portal link for social account connection
  async createPortalLink(portalData) {
    try {
      const response = await this.api.post('/social-account/create-portal-link', {
        teamId: portalData.teamId,
        socialAccountTypes: portalData.socialAccountTypes,
        redirectUrl: portalData.redirectUrl,
        logoUrl: portalData.logoUrl || undefined,
        userLogoUrl: portalData.userLogoUrl || undefined,
        userName: portalData.userName || undefined
      });

      logger.info('Portal link created:', { teamId: portalData.teamId, url: response.data.url });
      return response.data;
    } catch (error) {
      logger.error('Failed to create portal link:', error.response?.data || error.message);
      throw new Error('Failed to create social account connection link');
    }
  }

  // Connect social media account
  async connectSocialAccount(connectData) {
    try {
      const response = await this.api.post('/social-account/connect', connectData);

      logger.info('Social account connected:', { teamId: connectData.teamId, accountId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Failed to connect social account:', error.response?.data || error.message);
      throw new Error('Failed to connect social account');
    }
  }

  // Disconnect social media account
  async disconnectSocialAccount(type, teamId) {
    try {
      // Bundle.social expects type (platform) and teamId in request body
      const response = await this.api.delete('/social-account/disconnect', {
        data: {
          type: type.toUpperCase(), // Must be uppercase: TIKTOK, YOUTUBE, INSTAGRAM, etc.
          teamId: teamId
        }
      });
      
      logger.info('Social account disconnected from Bundle.social:', { type, teamId });
      return response.data;
    } catch (error) {
      logger.error('Failed to disconnect social account:', {
        error: error.response?.data || error.message,
        type,
        teamId
      });
      throw new Error(`Failed to disconnect social account: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get connected social accounts (from team details)
  async getSocialAccounts(teamId) {
    try {
      if (!teamId) {
        logger.warn('No teamId provided for getSocialAccounts');
        return [];
      }

      const team = await this.getTeam(teamId);
      const socialAccounts = team.socialAccounts || [];
      
      logger.info('Social accounts retrieved from Bundle.social:', { 
        teamId, 
        accountCount: socialAccounts.length,
        platforms: socialAccounts.map(acc => acc.platform || acc.type || 'unknown')
      });
      
      return socialAccounts;
    } catch (error) {
      logger.error('Failed to get social accounts:', error.response?.data || error.message);
      // Return empty array instead of throwing error to prevent crashes
      return [];
    }
  }

  // Upload video to Bundle.social directly from memory buffer
  async uploadVideo(teamId, videoData) {
    try {
      if (!teamId) {
        throw new Error('Team ID is required for Bundle.social upload');
      }

      if (!videoData.buffer) {
        throw new Error('Video buffer is required for Bundle.social upload');
      }

      const formData = new FormData();
      formData.append('file', videoData.buffer, {
        filename: videoData.originalname,
        contentType: videoData.mimetype || 'video/mp4' // Use actual mimetype or default
      });
      formData.append('teamId', teamId);

      logger.info('Uploading video directly to Bundle.social:', { 
        teamId, 
        filename: videoData.originalname,
        mimetype: videoData.mimetype,
        bufferSize: videoData.buffer.length 
      });

      const response = await this.api.post('/upload/', formData, {
        headers: {
          ...formData.getHeaders(),
          'x-api-key': bundleSocialConfig.apiKey, // Use config from database/env
        },
        timeout: 300000, // 5 minutes for direct video upload (increased timeout)
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      logger.info('Video uploaded to Bundle.social successfully (direct upload):', { 
        teamId, 
        uploadId: response.data.id,
        filename: videoData.originalname,
        directUpload: true
      });
      
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      const errorDetails = error.response?.data || error.message;
      
      logger.error('Failed to upload video directly to Bundle.social:', {
        teamId,
        filename: videoData.originalname,
        error: errorDetails,
        status: error.response?.status,
        statusText: error.response?.statusText,
        directUpload: true
      });
      
      throw new Error(`Bundle.social direct upload failed: ${errorMessage}`);
    }
  }

  // Get upload details
  async getUpload(uploadId) {
    try {
      const response = await this.api.get(`/upload/${uploadId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get upload:', error.response?.data || error.message);
      throw new Error('Failed to retrieve upload information');
    }
  }

  // Get upload list for team
  async getUploads(teamId, filters = {}) {
    try {
      const params = { teamId };
      
      // Add optional filters
      if (filters.type) params.type = filters.type; // 'image' or 'video'
      if (filters.status) params.status = filters.status; // 'USED' or 'UNUSED'
      
      const response = await this.api.get('/upload/', { params });
      
      logger.info('Fetched uploads from Bundle.social:', { 
        teamId, 
        count: response.data?.length || 0,
        filters 
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get uploads:', {
        teamId,
        error: error.response?.data || error.message
      });
      throw new Error('Failed to retrieve uploads list');
    }
  }

  // Delete upload
  async deleteUpload(uploadId) {
    try {
      await this.api.delete(`/upload/${uploadId}`);
      logger.info('Upload deleted from Bundle.social:', { uploadId });
    } catch (error) {
      logger.error('Failed to delete upload:', error.response?.data || error.message);
      throw new Error('Failed to delete upload');
    }
  }

  // Create immediate post (publish right now using past date)
  async createImmediatePost(postData, retryCount = 0) {
    const maxRetries = 2;
    
    try {
      // For immediate publishing, use past date and SCHEDULED status
      const pastDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      
      const payload = {
        teamId: postData.teamId,
        title: postData.title || `Post ${Date.now()}`,
        postDate: pastDate, // Past date for immediate publishing
        status: 'SCHEDULED', // Bundle.social publishes scheduled posts with past dates immediately
        socialAccountTypes: postData.socialAccountTypes,
        data: postData.data
      };

      logger.info('Bundle.social Immediate Post API Request:', payload);
      
      if (retryCount > 0) {
        logger.info(`Bundle.social API retry attempt ${retryCount}/${maxRetries}`);
      }

      const response = await this.api.post('/post/', payload);

      logger.info('Immediate post created in Bundle.social:', { 
        teamId: postData.teamId, 
        postId: response.data.id,
        publishType: 'immediate'
      });
      
      return response.data;
    } catch (error) {
      return this._handlePostError(error, postData, retryCount, maxRetries, 'createImmediatePost');
    }
  }

  // Create scheduled post for future publishing
  async createScheduledPost(postData, retryCount = 0) {
    const maxRetries = 2;
    
    try {
      const payload = {
        teamId: postData.teamId,
        title: postData.title || `Post ${Date.now()}`,
        postDate: postData.scheduledFor, // Future date for scheduled publishing
        status: 'SCHEDULED',
        socialAccountTypes: postData.socialAccountTypes,
        data: postData.data
      };

      logger.info('Bundle.social Scheduled Post API Request:', payload);
      
      if (retryCount > 0) {
        logger.info(`Bundle.social API retry attempt ${retryCount}/${maxRetries}`);
      }

      const response = await this.api.post('/post/', payload);

      logger.info('Scheduled post created in Bundle.social:', { 
        teamId: postData.teamId, 
        postId: response.data.id,
        scheduledFor: postData.scheduledFor,
        publishType: 'scheduled'
      });
      
      return response.data;
    } catch (error) {
      return this._handlePostError(error, postData, retryCount, maxRetries, 'createScheduledPost');
    }
  }

  // Helper method for error handling with retry logic
  async _handlePostError(error, postData, retryCount, maxRetries, methodName) {
    const errorDetails = error.response?.data || error.message;
    logger.error('Bundle.social API Error:', errorDetails);
    
    // Handle timeout errors with retry logic
    const isTimeoutError = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    
    if (isTimeoutError && retryCount < maxRetries) {
      const waitTime = (retryCount + 1) * 5000;
      logger.warn(`Bundle.social API timeout, retrying in ${waitTime/1000}s... (attempt ${retryCount + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this[methodName](postData, retryCount + 1);
    }
    
    logger.error('Failed to create post in Bundle.social:', errorDetails);
    
    let actualErrorMessage = error.response?.data?.message || error.message;
    
    if (isTimeoutError) {
      actualErrorMessage = `Bundle.social API timeout after ${maxRetries + 1} attempts. The video post may still be processing in Bundle.social.`;
    }
    
    throw new Error(actualErrorMessage);
  }

  // Legacy method for backward compatibility (now uses immediate post)
  async createPost(postData, retryCount = 0) {
    logger.warn('Using legacy createPost method, consider using createImmediatePost or createScheduledPost');
    return this.createImmediatePost(postData, retryCount);
  }

  // Update post
  async updatePost(postId, updateData) {
    try {
      const response = await this.api.put(`/post/${postId}`, updateData);
      logger.info('Post updated in Bundle.social:', { postId });
      return response.data;
    } catch (error) {
      logger.error('Failed to update post in Bundle.social:', error.response?.data || error.message);
      throw new Error('Failed to update social media post');
    }
  }

  // Delete post
  async deletePost(postId) {
    try {
      await this.api.delete(`/post/${postId}`);
      logger.info('Post deleted from Bundle.social:', { postId });
    } catch (error) {
      logger.error('Failed to delete post from Bundle.social:', error.response?.data || error.message);
      throw new Error('Failed to delete social media post');
    }
  }

  // Get post analytics
  async getPostAnalytics(postId) {
    try {
      const response = await this.api.get(`/analytics/post/${postId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get post analytics:', error.response?.data || error.message);
      throw new Error('Failed to retrieve post analytics');
    }
  }

  // Get account analytics
  async getAccountAnalytics(socialAccountId) {
    try {
      const response = await this.api.get(`/analytics/social-account/${socialAccountId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get account analytics:', error.response?.data || error.message);
      throw new Error('Failed to retrieve account analytics');
    }
  }

  // Get post by ID
  async getPost(postId) {
    try {
      const response = await this.api.get(`/post/${postId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get post:', error.response?.data || error.message);
      throw new Error('Failed to retrieve post');
    }
  }

  // Get organization details and usage
  async getOrganization() {
    try {
      const response = await this.api.get('/organization/');
      return response.data;
    } catch (error) {
      logger.error('Failed to get organization:', error.response?.data || error.message);
      throw new Error('Failed to retrieve organization information');
    }
  }

  // Delete team
  async deleteTeam(teamId) {
    try {
      await this.api.delete(`/team/${teamId}`);
      logger.info('Bundle.social team deleted:', { teamId });
    } catch (error) {
      logger.error('Failed to delete Bundle.social team:', error.response?.data || error.message);
      throw new Error('Failed to delete social media team');
    }
  }

  // Get team list
  async getTeamList() {
    try {
      const response = await this.api.get('/team/');
      return response.data;
    } catch (error) {
      logger.error('Failed to get team list:', error.response?.data || error.message);
      throw new Error('Failed to retrieve team list');
    }
  }

  // Get post list with filters
  async getPostList(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined) {
          params.append(key, filters[key]);
        }
      });

      const response = await this.api.get(`/post/?${params}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get post list:', error.response?.data || error.message);
      throw new Error('Failed to retrieve post list');
    }
  }
}

module.exports = new BundleSocialService();