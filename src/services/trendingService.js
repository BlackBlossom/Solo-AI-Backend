const axios = require('axios');
const configService = require('./configService');
const logger = require('../utils/logger');

/**
 * Trending Keywords Service
 * Integrates with Google Realtime Trends Data API via RapidAPI
 * Provides trending keywords by country and global trends
 */
class TrendingService {
  constructor() {
    this.initialized = false;
    this.apiKey = null;
    this.apiHost = null;
    this.baseURL = 'https://google-realtime-trends-data-api.p.rapidapi.com';
  }

  /**
   * Initialize the service with configuration from database
   */
  async initialize() {
    try {
      const config = await configService.getRapidApiConfig();
      
      if (!config || !config.key) {
        logger.warn('RapidAPI key not configured - Trending keywords service will not work');
        return;
      }

      this.apiKey = config.key;
      this.apiHost = config.host || 'google-realtime-trends-data-api.p.rapidapi.com';
      this.initialized = config.enabled !== false; // Default to true if not specified

      if (this.initialized) {
        logger.info('Trending keywords service initialized successfully', {
          source: config.key === process.env.RAPIDAPI_KEY ? 'environment' : 'database'
        });
      } else {
        logger.warn('Trending keywords service is disabled in settings');
      }
    } catch (error) {
      logger.error('Failed to initialize trending keywords service:', error.message);
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
   * Get trending keywords for a specific country
   * @param {string} country - Country name (e.g., 'India', 'United States', 'United Kingdom')
   * @returns {Promise<Object>} Trending keywords data
   */
  async getTrendsByCountry(country) {
    if (!this.isReady()) {
      throw new Error('Trending keywords service is not initialized or configured');
    }

    try {
      const options = {
        method: 'GET',
        url: `${this.baseURL}/trends/${encodeURIComponent(country)}`,
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost
        }
      };

      logger.info(`Fetching trends for country: ${country}`);
      const response = await axios.request(options);

      if (response.data && response.data.success) {
        logger.info(`Successfully fetched trends for ${country}`, {
          keywordsCount: response.data.data?.keywordsText?.length || 0
        });
        return response.data;
      } else {
        throw new Error('Invalid response from RapidAPI');
      }
    } catch (error) {
      if (error.response) {
        // API returned an error
        logger.error(`RapidAPI error for country ${country}:`, {
          status: error.response.status,
          message: error.response.data?.message || error.message
        });
        throw new Error(`Failed to fetch trends: ${error.response.data?.message || error.message}`);
      } else {
        // Network or other error
        logger.error(`Network error fetching trends for ${country}:`, error.message);
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  /**
   * Get trending keywords for all countries (global trends)
   * @returns {Promise<Object>} All countries' trending keywords
   */
  async getGlobalTrends() {
    if (!this.isReady()) {
      throw new Error('Trending keywords service is not initialized or configured');
    }

    try {
      const options = {
        method: 'GET',
        url: `${this.baseURL}/trends`,
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost
        }
      };

      logger.info('Fetching global trends for all countries');
      const response = await axios.request(options);

      if (response.data && response.data.success) {
        logger.info('Successfully fetched global trends', {
          countriesCount: response.data.data?.length || 0
        });
        return response.data;
      } else {
        throw new Error('Invalid response from RapidAPI');
      }
    } catch (error) {
      if (error.response) {
        logger.error('RapidAPI error for global trends:', {
          status: error.response.status,
          message: error.response.data?.message || error.message
        });
        throw new Error(`Failed to fetch global trends: ${error.response.data?.message || error.message}`);
      } else {
        logger.error('Network error fetching global trends:', error.message);
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  /**
   * Get trending keywords for multiple countries
   * @param {string[]} countries - Array of country names
   * @returns {Promise<Object[]>} Array of trending keywords by country
   */
  async getTrendsForCountries(countries) {
    if (!this.isReady()) {
      throw new Error('Trending keywords service is not initialized or configured');
    }

    if (!Array.isArray(countries) || countries.length === 0) {
      throw new Error('Countries must be a non-empty array');
    }

    try {
      const promises = countries.map(country => 
        this.getTrendsByCountry(country).catch(error => {
          logger.warn(`Failed to fetch trends for ${country}:`, error.message);
          return null; // Return null for failed requests
        })
      );

      const results = await Promise.all(promises);
      
      // Filter out failed requests
      return results.filter(result => result !== null);
    } catch (error) {
      logger.error('Error fetching trends for multiple countries:', error.message);
      throw error;
    }
  }

  /**
   * Get list of available countries from global trends
   * @returns {Promise<string[]>} Array of country names
   */
  async getAvailableCountries() {
    try {
      const globalTrends = await this.getGlobalTrends();
      
      if (globalTrends.data && Array.isArray(globalTrends.data)) {
        const countries = globalTrends.data.map(item => item.country).sort();
        logger.info(`Retrieved ${countries.length} available countries`);
        return countries;
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching available countries:', error.message);
      throw error;
    }
  }

  /**
   * Get trending keywords by region (continent/group)
   * @param {string} region - Region name (e.g., 'Asia', 'Europe', 'Americas')
   * @returns {Promise<Object[]>} Trending keywords for countries in the region
   */
  async getTrendsByRegion(region) {
    // Define region mappings
    const regionMap = {
      'Asia': ['India', 'China', 'Japan', 'South Korea', 'Thailand', 'Indonesia', 'Vietnam', 'Pakistan', 'Bangladesh', 'Malaysia', 'Philippines', 'Singapore'],
      'Europe': ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Poland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Belgium'],
      'Americas': ['United States', 'Canada', 'Brazil', 'Mexico', 'Argentina', 'Chile', 'Colombia', 'Peru'],
      'Middle East': ['Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Lebanon', 'Iraq'],
      'Africa': ['South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Ghana', 'Ethiopia', 'Morocco', 'Algeria'],
      'Oceania': ['Australia', 'New Zealand']
    };

    const countries = regionMap[region];
    
    if (!countries) {
      throw new Error(`Unknown region: ${region}. Available regions: ${Object.keys(regionMap).join(', ')}`);
    }

    logger.info(`Fetching trends for region: ${region} (${countries.length} countries)`);
    return this.getTrendsForCountries(countries);
  }
}

// Export singleton instance
module.exports = new TrendingService();
