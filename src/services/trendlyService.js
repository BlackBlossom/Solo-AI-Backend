const axios = require('axios');
const configService = require('./configService');
const logger = require('../utils/logger');
const TrendlyOptions = require('../models/TrendlyOptions');

/**
 * Trendly Service
 * Integrates with Google Trends API via RapidAPI (Trendly)
 * Provides historical trends data, interest over time, related queries, etc.
 */
class TrendlyService {
  constructor() {
    this.initialized = false;
    this.apiKey = null;
    this.apiHost = null;
    this.baseURL = 'https://trendly.p.rapidapi.com';
  }

  /**
   * Initialize the service with configuration from database
   */
  async initialize() {
    try {
      const config = await configService.getRapidApiConfig();
      
      if (!config || !config.key) {
        logger.warn('RapidAPI key not configured - Google Trends service will not work');
        return;
      }

      this.apiKey = config.key;
      this.apiHost = 'trendly.p.rapidapi.com';
      this.initialized = config.enabled !== false;

      if (this.initialized) {
        logger.info('Google Trends service initialized successfully', {
          source: config.key === process.env.RAPIDAPI_KEY ? 'environment' : 'database'
        });
      } else {
        logger.warn('Google Trends service is disabled in settings');
      }
    } catch (error) {
      logger.error('Failed to initialize Google Trends service:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Check if service is ready to use
   */
  isReady() {
    return this.initialized && this.apiKey;
  }

  /**
   * Make API request with error handling
   */
  async makeRequest(method, endpoint, data = null) {
    if (!this.isReady()) {
      throw new Error('Google Trends service is not initialized or configured');
    }

    try {
      const options = {
        method: method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost
        }
      };

      if (data && method === 'POST') {
        options.data = data;
        options.headers['Content-Type'] = 'application/json';
      }

      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      if (error.response) {
        logger.error(`Trendly API error for ${endpoint}:`, {
          status: error.response.status,
          message: error.response.data?.message || error.message
        });
        throw new Error(`API error: ${error.response.data?.msg || error.response.data?.message || error.message}`);
      } else {
        logger.error(`Network error for ${endpoint}:`, error.message);
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  /**
   * Get all categories (cached)
   * GET /cat
   */
  async getCategories(forceRefresh = false) {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = await TrendlyOptions.getCategories();
        if (cached) {
          logger.info('Categories retrieved from cache', { count: cached.length });
          return cached;
        }
      }

      logger.info('Fetching categories from Trendly API');
      const response = await this.makeRequest('GET', '/cat');
      
      if (response.cat && Array.isArray(response.cat)) {
        // Save to cache
        await TrendlyOptions.saveCategories(response.cat);
        logger.info('Categories fetched and cached', { count: response.cat.length });
        return response.cat;
      }

      throw new Error('Invalid categories response format');
    } catch (error) {
      logger.error('Error fetching categories:', error.message);
      throw error;
    }
  }

  /**
   * Get all geographic options (cached)
   * GET /geo
   */
  async getGeographic(forceRefresh = false) {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = await TrendlyOptions.getGeographic();
        if (cached) {
          const countryCount = cached.countries ? Object.keys(cached.countries).length : 0;
          logger.info('Geographic options retrieved from cache', { countries: countryCount });
          return cached;
        }
      }

      logger.info('Fetching geographic options from Google Trends API');
      const response = await this.makeRequest('GET', '/geo');
      
      if (response.geo && response.geo.countries) {
        // Save to cache
        await TrendlyOptions.saveGeographic(response.geo);
        const countryCount = Object.keys(response.geo.countries).length;
        logger.info('Geographic options fetched and cached', { countries: countryCount });
        return response.geo;
      }

      throw new Error('Invalid geographic options response format');
    } catch (error) {
      logger.error('Error fetching geographic options:', error.message);
      throw error;
    }
  }

  /**
   * Get interest over time for keywords
   * POST /historical
   * @param {Object} params - { keywords, start, country, region, category, gprop }
   */
  async getInterestOverTime(params) {
    try {
      const { keywords, start, country = '', region = '', category = '', gprop = '' } = params;

      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        throw new Error('Keywords array is required');
      }

      if (!start) {
        throw new Error('Start date is required (format: YYYY-MM-DDTHH:mm:ss+0100)');
      }

      const requestData = {
        keywords,
        start,
        country,
        region,
        category,
        gprop
      };

      logger.info('Fetching interest over time', { 
        keywords: keywords.join(', '), 
        country: country || 'worldwide' 
      });

      const response = await this.makeRequest('POST', '/historical', requestData);
      
      logger.info('Interest over time fetched successfully', { 
        keywords: keywords.length 
      });

      return response;
    } catch (error) {
      logger.error('Error fetching interest over time:', error.message);
      throw error;
    }
  }

  /**
   * Get interest by region for keywords
   * POST /region
   * @param {Object} params - { keywords, start, country, region, category, gprop, resolution, include_low_volume }
   */
  async getInterestByRegion(params) {
    try {
      const { 
        keywords, 
        start, 
        country = '', 
        region = '', 
        category = '', 
        gprop = '',
        resolution = 'COUNTRY',
        include_low_volume = false
      } = params;

      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        throw new Error('Keywords array is required');
      }

      if (!start) {
        throw new Error('Start date is required');
      }

      const requestData = {
        keywords,
        start,
        country,
        region,
        category,
        gprop,
        resolution,
        include_low_volume
      };

      logger.info('Fetching interest by region', { 
        keywords: keywords.join(', '), 
        resolution 
      });

      const response = await this.makeRequest('POST', '/region', requestData);
      
      logger.info('Interest by region fetched successfully');

      return response;
    } catch (error) {
      logger.error('Error fetching interest by region:', error.message);
      throw error;
    }
  }

  /**
   * Get related queries for keywords
   * POST /queries
   * @param {Object} params - { keywords, start, country, region, category, gprop }
   */
  async getRelatedQueries(params) {
    try {
      const { keywords, start, country = '', region = '', category = '', gprop = '' } = params;

      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        throw new Error('Keywords array is required');
      }

      if (!start) {
        throw new Error('Start date is required');
      }

      const requestData = {
        keywords,
        start,
        country,
        region,
        category,
        gprop
      };

      logger.info('Fetching related queries', { 
        keywords: keywords.join(', ') 
      });

      const response = await this.makeRequest('POST', '/queries', requestData);
      
      logger.info('Related queries fetched successfully');

      return response;
    } catch (error) {
      logger.error('Error fetching related queries:', error.message);
      throw error;
    }
  }

  /**
   * Get related topics for a keyword
   * POST /topics
   * @param {Object} params - { keywords (single), start, country, region, category, gprop }
   */
  async getRelatedTopics(params) {
    try {
      const { keywords, start, country = '', region = '', category = '', gprop = '' } = params;

      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        throw new Error('Keywords array is required');
      }

      // Note: API supports only one keyword for related topics
      if (keywords.length > 1) {
        logger.warn('Related topics API supports only one keyword, using first keyword only');
      }

      const requestData = {
        keywords: [keywords[0]], // Only use first keyword
        start,
        country,
        region,
        category,
        gprop
      };

      logger.info('Fetching related topics', { keyword: keywords[0] });

      const response = await this.makeRequest('POST', '/topics', requestData);
      
      logger.info('Related topics fetched successfully');

      return response;
    } catch (error) {
      logger.error('Error fetching related topics:', error.message);
      throw error;
    }
  }

  /**
   * Get top realtime searches
   * POST /realtime
   * @param {Object} params - { country, category }
   */
  async getRealtimeSearches(params) {
    try {
      const { country = '', category = 'All categories' } = params;

      const requestData = {
        country,
        category
      };

      logger.info('Fetching realtime searches', { country: country || 'worldwide' });

      const response = await this.makeRequest('POST', '/realtime', requestData);
      
      logger.info('Realtime searches fetched successfully');

      return response;
    } catch (error) {
      logger.error('Error fetching realtime searches:', error.message);
      throw error;
    }
  }

  /**
   * Get top searches today
   * POST /today
   * @param {Object} params - { country, category }
   */
  async getTodaySearches(params) {
    try {
      const { country = '', category = 'All categories' } = params;

      const requestData = {
        country,
        category
      };

      logger.info('Fetching today searches', { country: country || 'worldwide' });

      const response = await this.makeRequest('POST', '/today', requestData);
      
      logger.info('Today searches fetched successfully');

      return response;
    } catch (error) {
      logger.error('Error fetching today searches:', error.message);
      throw error;
    }
  }

  /**
   * Get keyword suggestions
   * POST /suggest
   * @param {Object} params - Suggestion parameters
   */
  async getSuggestions(params) {
    try {
      logger.info('Fetching keyword suggestions');

      const response = await this.makeRequest('POST', '/suggest', params);
      
      logger.info('Keyword suggestions fetched successfully');

      return response;
    } catch (error) {
      logger.error('Error fetching keyword suggestions:', error.message);
      throw error;
    }
  }

  /**
   * Get hot trending
   * POST /hot
   * @param {Object} params - Hot trending parameters
   */
  async getHotTrending(params) {
    try {
      logger.info('Fetching hot trending data');

      const response = await this.makeRequest('POST', '/hot', params);
      
      logger.info('Hot trending data fetched successfully');

      return response;
    } catch (error) {
      logger.error('Error fetching hot trending:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new TrendlyService();
