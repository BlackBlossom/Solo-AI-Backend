const { bundleSocialAPI } = require('../config/bundleSocial');
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
  async disconnectSocialAccount(disconnectData) {
    try {
      await this.api.delete('/social-account/disconnect', { data: disconnectData });
      logger.info('Social account disconnected:', disconnectData);
    } catch (error) {
      logger.error('Failed to disconnect social account:', error.response?.data || error.message);
      throw new Error('Failed to disconnect social account');
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

  // Upload video to Bundle.social
  async uploadVideo(teamId, videoData) {
    try {
      const formData = new FormData();
      formData.append('file', videoData.buffer, videoData.originalname);
      formData.append('teamId', teamId);

      const response = await this.api.post('/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes for video upload
      });

      logger.info('Video uploaded to Bundle.social:', { teamId, uploadId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Failed to upload video to Bundle.social:', error.response?.data || error.message);
      throw new Error('Failed to upload video to social media platform');
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

  // Create a post
  async createPost(postData) {
    try {
      const response = await this.api.post('/post/', {
        teamId: postData.teamId,
        title: postData.title || undefined,
        postDate: postData.scheduledFor || undefined,
        status: postData.status || 'DRAFT',
        socialAccountTypes: postData.socialAccountTypes,
        data: postData.data
      });

      logger.info('Post created in Bundle.social:', { teamId: postData.teamId, postId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Failed to create post in Bundle.social:', error.response?.data || error.message);
      throw new Error('Failed to create social media post');
    }
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