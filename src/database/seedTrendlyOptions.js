const mongoose = require('mongoose');
const dotenv = require('dotenv');
const TrendlyOptions = require('../models/TrendlyOptions');

// Load environment variables
dotenv.config();

/**
 * Seed Trendly Options (Categories and Geographic)
 * This script fetches and caches categories and geographic options from the Trendly API
 */
const seedTrendlyOptions = async () => {
  try {
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('✅ MongoDB Connected');

    console.log('');
    console.log('🌍 Seeding Google Trends options...');
    console.log('');

    // Import trendlyService (after DB connection)
    const trendlyService = require('../services/trendlyService');
    await trendlyService.initialize();

    if (!trendlyService.isReady()) {
      console.error('❌ Google Trends service is not configured');
      console.error('Please set RAPIDAPI_KEY in your environment variables');
      process.exit(1);
    }

    // Fetch and save categories
    console.log('📋 Fetching categories from Trendly API...');
    try {
      const categories = await trendlyService.getCategories(true); // Force refresh
      console.log(`✅ Fetched and cached ${categories.length} categories`);
      console.log('   Sample categories:', categories.slice(0, 5).join(', '), '...');
    } catch (error) {
      console.error('❌ Failed to fetch categories:', error.message);
    }

    console.log('');

    // Fetch and save geographic options
    console.log('🌎 Fetching geographic options from Trendly API...');
    try {
      const geo = await trendlyService.getGeographic(true); // Force refresh
      const countryCount = geo.countries ? Object.keys(geo.countries).length : 0;
      console.log(`✅ Fetched and cached ${countryCount} countries with their regions`);
      
      // Sample countries
      const sampleCountries = Object.keys(geo.countries).slice(0, 5);
      console.log('   Sample countries:', sampleCountries.join(', '), '...');
    } catch (error) {
      console.error('❌ Failed to fetch geographic options:', error.message);
    }

    console.log('');
    console.log('🎉 Trendly options seeded successfully!');
    console.log('');
    console.log('The options will be cached for 30 days and auto-refresh afterward.');
    console.log('');

  } catch (error) {
    console.error('❌ Error seeding Trendly options:', error.message);
    process.exit(1);
  } finally {
    console.log('📪 Closing MongoDB connection...');
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Run the seeder
seedTrendlyOptions();
