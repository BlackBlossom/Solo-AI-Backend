const mongoose = require('mongoose');

const inspirationCacheSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  region: {
    type: String,
    default: 'US',
    uppercase: true
  },
  type: {
    type: String,
    enum: ['reddit', 'trends', 'country_trends', 'global_trends'],
    default: 'reddit',
    index: true
  },
  country: {
    type: String,
    trim: true,
    index: true // For country-specific trending keywords
  },
  data: {
    googleTrends: {
      interestOverTime: Array,
      relatedQueries: Object,
      risingQueries: Array
    },
    reddit: {
      posts: Array,
      totalFound: Number
    },
    trending: {
      keywordsText: [String], // Array of trending keywords
      lastUpdate: String,
      scrapedAt: Date
    },
    globalTrends: Array, // Array of country trend objects
    countryTrends: Object // Country-specific trend object
  },
  hitCount: {
    type: Number,
    default: 0
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: process.env.INSPIRATION_CACHE_TTL || 86400 // Auto-delete after TTL (24 hours default)
  }
}, {
  timestamps: true
});

// Compound indexes for faster lookups
inspirationCacheSchema.index({ topic: 1, region: 1 });
inspirationCacheSchema.index({ type: 1, country: 1 });
inspirationCacheSchema.index({ type: 1, createdAt: -1 });
inspirationCacheSchema.index({ user: 1, createdAt: -1 });

// Method to increment hit count
inspirationCacheSchema.methods.incrementHits = async function() {
  this.hitCount += 1;
  return this.save();
};

// Static method to get cached data
inspirationCacheSchema.statics.getCached = async function(topic, region = 'US', userId = null, type = 'reddit') {
  const query = { 
    topic: topic.toLowerCase(), 
    region: region.toUpperCase(),
    type
  };
  
  if (userId) {
    query.user = userId;
  }
  
  const cached = await this.findOne(query);
  
  if (cached) {
    await cached.incrementHits();
  }
  
  return cached;
};

/**
 * Static method to get cached trending data by country
 */
inspirationCacheSchema.statics.getCachedTrends = async function(country, type = 'country_trends') {
  const query = {
    country: country,
    type: type
  };
  
  const cached = await this.findOne(query).sort({ createdAt: -1 });
  
  if (cached) {
    await cached.incrementHits();
  }
  
  return cached;
};

/**
 * Static method to get cached global trends
 */
inspirationCacheSchema.statics.getCachedGlobalTrends = async function() {
  const query = {
    type: 'global_trends'
  };
  
  const cached = await this.findOne(query).sort({ createdAt: -1 });
  
  if (cached) {
    await cached.incrementHits();
  }
  
  return cached;
};

module.exports = mongoose.model('InspirationCache', inspirationCacheSchema);
