const redditService = require('../services/redditService');
const InspirationCache = require('../models/InspirationCache');
const logger = require('../utils/logger');
const { sendSuccess, sendBadRequest } = require('../utils/response');
const AppError = require('../utils/appError');

/**
 * Search for inspiration on any topic (Reddit only)
 */
exports.searchInspiration = async (req, res, next) => {
  try {
    const { topic, limit = 10 } = req.query;

    if (!topic) {
      return sendBadRequest(res, 'Topic parameter is required');
    }

    const userId = req.user?._id;

    // Check cache first
    const cached = await InspirationCache.getCached(topic, 'reddit', userId);
    
    if (cached) {
      logger.info(`Cache hit for topic: ${topic}`);
      return sendSuccess(res, 'Inspiration data retrieved from cache', {
        ...cached.data,
        topic,
        timestamp: cached.createdAt,
        fromCache: true
      });
    }

    // Fetch fresh data from Reddit
    logger.info(`Fetching fresh data for topic: ${topic}`);
    
    const redditPosts = await redditService.searchPosts(topic, { 
      limit: parseInt(limit), 
      sort: 'hot', 
      time: 'week' 
    });

    const responseData = {
      topic,
      timestamp: new Date().toISOString(),
      reddit: {
        posts: redditPosts,
        totalFound: redditPosts.length
      }
    };

    // Save to cache
    try {
      await InspirationCache.create({
        topic: topic.toLowerCase(),
        region: 'reddit',
        data: responseData,
        user: userId
      });
    } catch (cacheError) {
      logger.error('Failed to cache inspiration data:', cacheError.message);
    }

    return sendSuccess(res, 'Inspiration data fetched successfully', responseData);

  } catch (error) {
    logger.error('Inspiration search error:', error);
    next(new AppError(error.message || 'Failed to fetch inspiration data', error.statusCode || 500));
  }
};

/**
 * Get trending topics from Reddit
 */
exports.getTrendingTopics = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    const redditTrending = await redditService.getTrendingPosts(parseInt(limit));

    return sendSuccess(res, 'Trending topics retrieved successfully', {
      reddit: redditTrending,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Trending topics error:', error);
    next(new AppError('Failed to fetch trending topics', 500));
  }
};

/**
 * Get subreddit-specific posts
 */
exports.getSubredditPosts = async (req, res, next) => {
  try {
    const { subreddit } = req.params;
    const { limit = 10, sort = 'hot' } = req.query;

    if (!subreddit) {
      return sendBadRequest(res, 'Subreddit parameter is required');
    }

    const posts = await redditService.getSubredditPosts(subreddit, {
      limit: parseInt(limit),
      sort
    });

    return sendSuccess(res, `Posts from r/${subreddit} retrieved successfully`, {
      subreddit,
      posts,
      total: posts.length
    });

  } catch (error) {
    logger.error(`Subreddit posts error for r/${req.params.subreddit}:`, error);
    next(new AppError(`Failed to fetch subreddit posts: ${error.message}`, 500));
  }
};
