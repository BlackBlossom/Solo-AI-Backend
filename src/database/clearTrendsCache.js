const mongoose = require('mongoose');
const dotenv = require('dotenv');
const InspirationCache = require('../models/InspirationCache');

// Load environment variables
dotenv.config();

/**
 * Clear trending keywords cache
 * Run this script to remove stale/corrupted cache data
 */
const clearTrendsCache = async () => {
  try {
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('✅ MongoDB Connected');

    console.log('🧹 Clearing trending keywords cache...');
    
    const result = await InspirationCache.deleteMany({ 
      type: { $in: ['global_trends', 'country_trends'] } 
    });

    console.log(`✅ Cleared ${result.deletedCount} cached trending entries`);
    console.log('');
    console.log('🎉 Cache cleared successfully!');
    console.log('The next API request will fetch fresh data from RapidAPI.');
    console.log('');

  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
    process.exit(1);
  } finally {
    console.log('📪 Closing MongoDB connection...');
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Run the script
clearTrendsCache();
