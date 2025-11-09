const axios = require('axios');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');

class RedditService {
  constructor() {
    this.baseURL = 'https://oauth.reddit.com';
    this.authURL = 'https://www.reddit.com/api/v1/access_token';
    this.clientId = process.env.REDDIT_CLIENT_ID;
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET;
    this.username = process.env.REDDIT_USERNAME;
    this.password = process.env.REDDIT_PASSWORD;
    this.userAgent = process.env.REDDIT_USER_AGENT || 'SoloAI/1.0.0';
    this.accessToken = null;
    this.tokenExpiry = null;
    
    if (this.clientId && this.clientSecret && this.username && this.password) {
      logger.info('Reddit API configuration loaded');
    } else {
      logger.warn('Reddit API credentials not configured');
    }
  }

  /**
   * Get OAuth access token
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        this.authURL,
        new URLSearchParams({
          grant_type: 'password',
          username: this.username,
          password: this.password
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Token expires in 1 hour, refresh 5 minutes early
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
      
      logger.info('Reddit OAuth token obtained successfully');
      return this.accessToken;

    } catch (error) {
      logger.error('Failed to get Reddit access token:', error.message);
      throw new AppError('Reddit authentication failed', 500);
    }
  }

  /**
   * Make authenticated request to Reddit API
   */
  async makeRequest(endpoint, params = {}) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': this.userAgent
        },
        timeout: 10000
      });

      return response.data;

    } catch (error) {
      if (error.response) {
        logger.error(`Reddit API Error (${error.response.status}):`, error.response.data);
        
        if (error.response.status === 429) {
          throw new AppError('Reddit API rate limit exceeded', 429);
        }
        
        throw new AppError(`Reddit API error: ${error.response.data.message || 'Unknown error'}`, error.response.status);
      }
      
      throw new AppError('Failed to reach Reddit API', 503);
    }
  }

  /**
   * Search Reddit for posts related to keyword
   */
  async searchPosts(keyword, options = {}) {
    if (!this.clientId || !this.clientSecret) {
      throw new AppError('Reddit API not configured', 500);
    }

    try {
      const {
        limit = 10,
        sort = 'relevance', // 'relevance', 'hot', 'top', 'new', 'comments'
        time = 'week', // 'hour', 'day', 'week', 'month', 'year', 'all'
        subreddit = 'all'
      } = options;

      logger.info(`Searching Reddit for: ${keyword}`);

      const endpoint = `/r/${subreddit}/search`;
      const params = {
        q: keyword,
        sort: sort,
        t: time,
        limit: Math.min(limit, 100),
        raw_json: 1
      };

      const data = await this.makeRequest(endpoint, params);
      
      return this.formatPosts(data.data.children);

    } catch (error) {
      logger.error('Reddit search error:', error.message);
      throw error;
    }
  }

  /**
   * Get hot posts from subreddit
   */
  async getHotPosts(subreddit = 'all', limit = 25) {
    try {
      const endpoint = `/r/${subreddit}/hot`;
      const params = { limit: Math.min(limit, 100) };

      const data = await this.makeRequest(endpoint, params);
      
      return this.formatPosts(data.data.children);

    } catch (error) {
      logger.error('Failed to fetch hot posts:', error.message);
      return [];
    }
  }

  /**
   * Get trending posts from r/all
   */
  async getTrendingPosts(limit = 20) {
    return this.getHotPosts('all', limit);
  }

  /**
   * Get posts from specific subreddit
   */
  async getSubredditPosts(subreddit, options = {}) {
    if (!this.clientId || !this.clientSecret) {
      throw new AppError('Reddit API not configured', 500);
    }

    try {
      const { limit = 10, sort = 'hot' } = options;
      
      let endpoint;
      switch(sort) {
        case 'hot':
          endpoint = `/r/${subreddit}/hot`;
          break;
        case 'new':
          endpoint = `/r/${subreddit}/new`;
          break;
        case 'top':
          endpoint = `/r/${subreddit}/top`;
          break;
        case 'rising':
          endpoint = `/r/${subreddit}/rising`;
          break;
        default:
          endpoint = `/r/${subreddit}/hot`;
      }

      const params = { 
        limit: Math.min(limit, 100),
        t: 'week' // for 'top' sort
      };

      const data = await this.makeRequest(endpoint, params);
      
      return this.formatPosts(data.data.children);

    } catch (error) {
      logger.error(`Failed to fetch r/${subreddit} posts:`, error.message);
      throw error;
    }
  }

  /**
   * Format Reddit posts into consistent structure
   */
  formatPosts(children) {
    return children
      .filter(child => child.kind === 't3') // Only posts, not comments
      .map(child => {
        const post = child.data;
        return {
          id: post.id,
          title: post.title,
          subreddit: post.subreddit,
          author: post.author,
          score: post.score,
          upvoteRatio: post.upvote_ratio,
          numComments: post.num_comments,
          url: `https://reddit.com${post.permalink}`,
          createdAt: new Date(post.created_utc * 1000).toISOString(),
          thumbnail: post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default' 
            ? post.thumbnail 
            : null,
          isVideo: post.is_video || false,
          selftext: post.selftext ? post.selftext.substring(0, 200) : null,
          domain: post.domain,
          gilded: post.gilded,
          over18: post.over_18
        };
      });
  }

  /**
   * Get subreddit info
   */
  async getSubredditInfo(subreddit) {
    try {
      const endpoint = `/r/${subreddit}/about`;
      const data = await this.makeRequest(endpoint);
      
      return {
        name: data.data.display_name,
        title: data.data.title,
        description: data.data.public_description,
        subscribers: data.data.subscribers,
        activeUsers: data.data.active_user_count,
        created: new Date(data.data.created_utc * 1000).toISOString(),
        over18: data.data.over18
      };

    } catch (error) {
      logger.error(`Failed to fetch r/${subreddit} info:`, error.message);
      throw new AppError('Failed to fetch subreddit information', 500);
    }
  }
}

module.exports = new RedditService();
