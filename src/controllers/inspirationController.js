const redditService = require('../services/redditService');
const trendingService = require('../services/trendingService');
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

/**
 * Get trending keywords by country
 */
exports.getTrendingKeywordsByCountry = async (req, res, next) => {
  try {
    const { country } = req.params;

    if (!country) {
      return sendBadRequest(res, 'Country parameter is required');
    }

    // Check cache first
    const cached = await InspirationCache.getCachedTrends(country, 'country_trends');
    
    if (cached) {
      logger.info(`Cache hit for trending keywords in ${country}`);
      return sendSuccess(res, 'Trending keywords retrieved from cache', {
        country: cached.country,
        keywords: cached.data.trending.keywordsText,
        lastUpdate: cached.data.trending.lastUpdate,
        scrapedAt: cached.data.trending.scrapedAt,
        fromCache: true,
        timestamp: cached.createdAt
      });
    }

    // Fetch fresh data from RapidAPI
    logger.info(`Fetching fresh trending keywords for ${country}`);
    
    const trendsData = await trendingService.getTrendsByCountry(country);

    if (!trendsData.success || !trendsData.data) {
      throw new AppError('Failed to fetch trending keywords', 500);
    }

    const responseData = {
      country: trendsData.data.country,
      keywords: trendsData.data.keywordsText,
      lastUpdate: trendsData.data.lastUpdate,
      scrapedAt: trendsData.data.scrapedAt,
      fromCache: false
    };

    // Save to cache
    try {
      await InspirationCache.create({
        topic: `trends_${country.toLowerCase()}`,
        country: country,
        type: 'country_trends',
        data: {
          trending: {
            keywordsText: trendsData.data.keywordsText,
            lastUpdate: trendsData.data.lastUpdate,
            scrapedAt: trendsData.data.scrapedAt
          }
        },
        createdAt: new Date()
      });
      logger.info(`Cached trending keywords for ${country}`);
    } catch (cacheError) {
      logger.error('Failed to cache trending keywords:', cacheError.message);
    }

    return sendSuccess(res, 'Trending keywords fetched successfully', responseData);

  } catch (error) {
    logger.error(`Trending keywords error for ${req.params.country}:`, error);
    next(new AppError(error.message || 'Failed to fetch trending keywords', error.statusCode || 500));
  }
};

/**
 * Get global trending keywords (all countries)
 */
exports.getGlobalTrends = async (req, res, next) => {
  try {
    const { limit } = req.query;

    // Check cache first
    const cached = await InspirationCache.getCachedGlobalTrends();
    
    if (cached && cached.data && cached.data.globalTrends) {
      logger.info('Cache hit for global trending keywords');
      let data = cached.data.globalTrends;
      
      // Apply limit if specified
      if (limit && Array.isArray(data)) {
        const limitNum = parseInt(limit);
        data = data.slice(0, limitNum);
      }
      
      return sendSuccess(res, 'Global trending keywords retrieved from cache', {
        countries: data,
        totalCountries: cached.data.globalTrends.length,
        fromCache: true,
        timestamp: cached.createdAt
      });
    }

    // Fetch fresh data from RapidAPI
    logger.info('Fetching fresh global trending keywords');
    
    const trendsData = await trendingService.getGlobalTrends();

    if (!trendsData.success || !trendsData.data) {
      throw new AppError('Failed to fetch global trends', 500);
    }

    let countriesData = trendsData.data;
    
    // Apply limit if specified
    if (limit) {
      const limitNum = parseInt(limit);
      countriesData = countriesData.slice(0, limitNum);
    }

    const responseData = {
      countries: countriesData,
      totalCountries: trendsData.data.length,
      fromCache: false,
      timestamp: trendsData.timestamp
    };

    // Save to cache
    try {
      await InspirationCache.create({
        topic: 'global_trends',
        type: 'global_trends',
        data: {
          globalTrends: trendsData.data // Store full array of country objects
        },
        createdAt: new Date()
      });
      logger.info('Cached global trending keywords');
    } catch (cacheError) {
      logger.error('Failed to cache global trends:', cacheError.message);
    }

    return sendSuccess(res, 'Global trending keywords fetched successfully', responseData);

  } catch (error) {
    logger.error('Global trends error:', error);
    next(new AppError(error.message || 'Failed to fetch global trends', error.statusCode || 500));
  }
};

/**
 * Get available countries list
 */
exports.getAvailableCountries = async (req, res, next) => {
  try {
    logger.info('Fetching available countries list');
    
    const countries = await trendingService.getAvailableCountries();

    return sendSuccess(res, 'Available countries retrieved successfully', {
      countries,
      total: countries.length
    });

  } catch (error) {
    logger.error('Available countries error:', error);
    next(new AppError('Failed to fetch available countries', 500));
  }
};

/**
 * Get trending keywords by region
 */
exports.getTrendingByRegion = async (req, res, next) => {
  try {
    const { region } = req.params;

    if (!region) {
      return sendBadRequest(res, 'Region parameter is required');
    }

    logger.info(`Fetching trending keywords for region: ${region}`);
    
    const trendsData = await trendingService.getTrendsByRegion(region);

    return sendSuccess(res, `Trending keywords for ${region} retrieved successfully`, {
      region,
      countries: trendsData.map(t => ({
        country: t.data?.country,
        keywords: t.data?.keywordsText,
        lastUpdate: t.data?.lastUpdate
      })),
      total: trendsData.length
    });

  } catch (error) {
    logger.error(`Region trends error for ${req.params.region}:`, error);
    next(new AppError(error.message || 'Failed to fetch regional trends', 500));
  }
};
