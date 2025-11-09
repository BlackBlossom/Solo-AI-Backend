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
  data: {
    googleTrends: {
      interestOverTime: Array,
      relatedQueries: Object,
      risingQueries: Array
    },
    reddit: {
      posts: Array,
      totalFound: Number
    }
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

// Compound index for faster lookups
inspirationCacheSchema.index({ topic: 1, region: 1 });
inspirationCacheSchema.index({ user: 1, createdAt: -1 });

// Method to increment hit count
inspirationCacheSchema.methods.incrementHits = async function() {
  this.hitCount += 1;
  return this.save();
};

// Static method to get cached data
inspirationCacheSchema.statics.getCached = async function(topic, region = 'US', userId = null) {
  const query = { 
    topic: topic.toLowerCase(), 
    region: region.toUpperCase() 
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

module.exports = mongoose.model('InspirationCache', inspirationCacheSchema);
