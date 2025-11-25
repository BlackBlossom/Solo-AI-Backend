const redditService = require('../services/redditService');
const trendlyService = require('../services/trendlyService');
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

// ============================================================================
// GOOGLE TRENDS HISTORICAL DATA ENDPOINTS
// ============================================================================

/**
 * Get all available categories
 */
exports.getCategories = async (req, res, next) => {
  try {
    logger.info('Fetching Google Trends categories');
    
    const categories = await trendlyService.getCategories();

    return sendSuccess(res, 'Categories retrieved successfully', {
      categories,
      total: categories.length
    });

  } catch (error) {
    logger.error('Categories error:', error);
    next(new AppError(error.message || 'Failed to fetch categories', 500));
  }
};

/**
 * Get all geographic options (countries and regions)
 */
exports.getGeographic = async (req, res, next) => {
  try {
    logger.info('Fetching Google Trends geographic options');
    
    const geo = await trendlyService.getGeographic();

    const countryCount = geo.countries ? Object.keys(geo.countries).length : 0;

    return sendSuccess(res, 'Geographic options retrieved successfully', {
      geo,
      countriesCount: countryCount
    });

  } catch (error) {
    logger.error('Geographic options error:', error);
    next(new AppError(error.message || 'Failed to fetch geographic options', 500));
  }
};

/**
 * Get interest over time for keywords
 */
exports.getInterestOverTime = async (req, res, next) => {
  try {
    const { keywords, start, country, region, category, gprop } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return sendBadRequest(res, 'Keywords array is required');
    }

    if (!start) {
      return sendBadRequest(res, 'Start date is required (format: YYYY-MM-DDTHH:mm:ss+0100)');
    }

    logger.info('Fetching interest over time', { keywords: keywords.join(', ') });

    const data = await trendlyService.getInterestOverTime({
      keywords,
      start,
      country: country || '',
      region: region || '',
      category: category || '',
      gprop: gprop || ''
    });

    return sendSuccess(res, 'Interest over time data retrieved successfully', {
      data,
      keywords,
      country: country || 'worldwide',
      startDate: start
    });

  } catch (error) {
    logger.error('Interest over time error:', error);
    next(new AppError(error.message || 'Failed to fetch interest over time', 500));
  }
};

/**
 * Get interest by region for keywords
 */
exports.getInterestByRegion = async (req, res, next) => {
  try {
    const { keywords, start, country, region, category, gprop, resolution, include_low_volume } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return sendBadRequest(res, 'Keywords array is required');
    }

    if (!start) {
      return sendBadRequest(res, 'Start date is required');
    }

    logger.info('Fetching interest by region', { keywords: keywords.join(', ') });

    const data = await trendlyService.getInterestByRegion({
      keywords,
      start,
      country: country || '',
      region: region || '',
      category: category || '',
      gprop: gprop || '',
      resolution: resolution || 'COUNTRY',
      include_low_volume: include_low_volume || false
    });

    return sendSuccess(res, 'Interest by region data retrieved successfully', {
      data,
      keywords,
      resolution: resolution || 'COUNTRY'
    });

  } catch (error) {
    logger.error('Interest by region error:', error);
    next(new AppError(error.message || 'Failed to fetch interest by region', 500));
  }
};

/**
 * Get related queries for keywords
 */
exports.getRelatedQueries = async (req, res, next) => {
  try {
    const { keywords, start, country, region, category, gprop } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return sendBadRequest(res, 'Keywords array is required');
    }

    if (!start) {
      return sendBadRequest(res, 'Start date is required');
    }

    logger.info('Fetching related queries', { keywords: keywords.join(', ') });

    const data = await trendlyService.getRelatedQueries({
      keywords,
      start,
      country: country || '',
      region: region || '',
      category: category || '',
      gprop: gprop || ''
    });

    return sendSuccess(res, 'Related queries retrieved successfully', {
      data,
      keywords
    });

  } catch (error) {
    logger.error('Related queries error:', error);
    next(new AppError(error.message || 'Failed to fetch related queries', 500));
  }
};

/**
 * Get related topics for a keyword
 */
exports.getRelatedTopics = async (req, res, next) => {
  try {
    const { keywords, start, country, region, category, gprop } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return sendBadRequest(res, 'Keywords array is required');
    }

    if (!start) {
      return sendBadRequest(res, 'Start date is required');
    }

    logger.info('Fetching related topics', { keyword: keywords[0] });

    const data = await trendlyService.getRelatedTopics({
      keywords,
      start,
      country: country || '',
      region: region || '',
      category: category || '',
      gprop: gprop || ''
    });

    return sendSuccess(res, 'Related topics retrieved successfully', {
      data,
      keyword: keywords[0]
    });

  } catch (error) {
    logger.error('Related topics error:', error);
    next(new AppError(error.message || 'Failed to fetch related topics', 500));
  }
};

/**
 * Get realtime searches
 */
exports.getRealtimeSearches = async (req, res, next) => {
  try {
    const { country, category } = req.body;

    logger.info('Fetching realtime searches', { country: country || 'worldwide' });

    const data = await trendlyService.getRealtimeSearches({
      country: country || '',
      category: category || 'All categories'
    });

    return sendSuccess(res, 'Realtime searches retrieved successfully', {
      data,
      country: country || 'worldwide'
    });

  } catch (error) {
    logger.error('Realtime searches error:', error);
    next(new AppError(error.message || 'Failed to fetch realtime searches', 500));
  }
};

/**
 * Get today's top searches
 */
exports.getTodaySearches = async (req, res, next) => {
  try {
    const { country, category } = req.body;

    logger.info('Fetching today searches', { country: country || 'worldwide' });

    const data = await trendlyService.getTodaySearches({
      country: country || '',
      category: category || 'All categories'
    });

    return sendSuccess(res, 'Today searches retrieved successfully', {
      data,
      country: country || 'worldwide'
    });

  } catch (error) {
    logger.error('Today searches error:', error);
    next(new AppError(error.message || 'Failed to fetch today searches', 500));
  }
};
