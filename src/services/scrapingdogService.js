const axios = require('axios');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');

class ScrapingdogService {
  constructor() {
    this.baseURL = process.env.SCRAPINGDOG_BASE_URL || 'https://api.scrapingdog.com';
    this.apiKey = process.env.SCRAPINGDOG_API_KEY;
    this.timeout = 30000; // 30 seconds (Google Trends can be slow)
  }

  /**
   * Fetch Google Trends data for a keyword
   * According to Scrapingdog documentation:
   * - Base URL: https://api.scrapingdog.com/google_trends
   * - Parameters: api_key (required), query, language, geo, data_type, etc.
   */
  async getGoogleTrends(keyword, options = {}) {
    const startTime = Date.now();
    
    try {
      if (!this.apiKey) {
        throw new AppError('Scrapingdog API key not configured', 500);
      }

      // Build parameters according to Scrapingdog API documentation
      const params = {
        api_key: this.apiKey,
        query: keyword,
        data_type: options.data_type || 'TIMESERIES', // TIMESERIES, GEO_MAP, GEO_MAP_0
      };

      // Optional parameters (only add if they have actual values)
      if (options.language) params.language = options.language;
      if (options.geo || options.region) params.geo = options.geo || options.region;
      if (options.region && !options.geo) params.region = options.region;
      if (options.tz) params.tz = options.tz;
      if (options.cat) params.cat = options.cat;
      if (options.gprop) params.gprop = options.gprop;
      if (options.date) params.date = options.date;

      logger.info(`Fetching Google Trends for: "${keyword}" (geo: ${params.geo}, data_type: ${params.data_type})`);

      const response = await axios.get(`${this.baseURL}/google_trends`, {
        params,
        timeout: this.timeout
      });

      const responseTime = Date.now() - startTime;
      logger.info(`Scrapingdog API responded in ${responseTime}ms`);

      // Parse response according to documentation
      // Response structure varies by data_type
      const data = response.data;
      
      return {
        success: true,
        data_type: params.data_type,
        keyword: keyword,
        geo: params.geo,
        // TIMESERIES returns: timeline data with dates and values
        timeline: data.timeline || data.interest_over_time || [],
        // GEO_MAP returns: regional breakdown
        geoMap: data.geo_map || data.by_region || [],
        // Related queries and topics
        relatedQueries: data.related_queries || {},
        relatedTopics: data.related_topics || [],
        // Raw response for flexibility
        rawData: data
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (error.response) {
        logger.error(`Scrapingdog API Error (${error.response.status}):`, {
          status: error.response.status,
          data: error.response.data,
          keyword: keyword
        });
        
        const errorMessage = error.response.data?.message 
          || error.response.data?.error 
          || 'Google Trends API request failed';
        
        // Provide helpful error message for API key issues
        if (error.response.status === 400 || error.response.status === 401) {
          logger.warn('Scrapingdog API Key may need activation or may have expired');
          logger.warn('Please check your account at: https://app.scrapingdog.com/');
        }
          
        throw new AppError(
          `Google Trends API error: ${errorMessage}. ${error.response.status === 400 ? 'Please verify your Scrapingdog API key is active at https://app.scrapingdog.com/' : ''}`,
          error.response.status
        );
      } else if (error.request) {
        logger.error('Scrapingdog API timeout or network error:', {
          message: error.message,
          timeout: this.timeout,
          responseTime
        });
        throw new AppError('Failed to reach Google Trends API - request timeout', 503);
      } else {
        logger.error('Scrapingdog service error:', error.message);
        throw new AppError(`Google Trends service error: ${error.message}`, 500);
      }
    }
  }

  /**
   * Get trending searches for a region
   * Uses the Google Trends Trending Now API
   */
  async getTrendingSearches(region = 'US', options = {}) {
    try {
      if (!this.apiKey) {
        throw new AppError('Scrapingdog API key not configured', 500);
      }

      const params = {
        api_key: this.apiKey,
        geo: region,
        hours: options.hours || '24', // 4, 24, 48, or 168
        language: options.language || 'en'
      };

      logger.info(`Fetching trending searches for region: ${region}`);

      const response = await axios.get(`${this.baseURL}/google_trends/trending_now`, {
        params,
        timeout: this.timeout
      });

      return response.data?.trending_searches || response.data || [];

    } catch (error) {
      logger.error('Failed to fetch trending searches:', {
        message: error.message,
        region: region,
        status: error.response?.status
      });
      
      // Return empty array on error to not break the flow
      return [];
    }
  }

  /**
   * Get autocomplete suggestions for a query
   * Uses the Google Trends Autocomplete API
   */
  async getAutocompleteSuggestions(query, language = 'en') {
    try {
      if (!this.apiKey) {
        throw new AppError('Scrapingdog API key not configured', 500);
      }

      const params = {
        api_key: this.apiKey,
        query: query,
        language: language
      };

      logger.info(`Fetching autocomplete suggestions for: "${query}"`);

      const response = await axios.get(`${this.baseURL}/google_trends/autocomplete`, {
        params,
        timeout: this.timeout
      });

      return response.data?.suggestions || [];

    } catch (error) {
      logger.error('Failed to fetch autocomplete suggestions:', {
        message: error.message,
        query: query
      });
      
      return [];
    }
  }
}

module.exports = new ScrapingdogService();
