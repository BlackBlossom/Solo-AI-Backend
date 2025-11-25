const mongoose = require('mongoose');

/**
 * TrendlyOptions Schema
 * Caches Google Trends categories and geographic options
 * to avoid repeated API calls
 */
const trendlyOptionsSchema = new mongoose.Schema({
  _id: {
    type: String,
    enum: ['categories', 'geographic'], // Only two documents: one for categories, one for geo
    required: true
  },

  // For categories
  categories: {
    type: [String],
    default: []
  },

  // For geographic options
  geo: {
    countries: {
      type: Object,
      default: {}
    }
  },

  lastUpdated: {
    type: Date,
    default: Date.now
  },

  // Auto-update after 30 days (categories and geo don't change often)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
}, {
  timestamps: true
});

// Index for expiration
trendlyOptionsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Get categories from cache
 */
trendlyOptionsSchema.statics.getCategories = async function() {
  const doc = await this.findById('categories');
  if (!doc || !doc.categories || doc.categories.length === 0) {
    return null;
  }
  return doc.categories;
};

/**
 * Get geographic options from cache
 */
trendlyOptionsSchema.statics.getGeographic = async function() {
  const doc = await this.findById('geographic');
  if (!doc || !doc.geo || !doc.geo.countries) {
    return null;
  }
  return doc.geo;
};

/**
 * Save categories to cache
 */
trendlyOptionsSchema.statics.saveCategories = async function(categories) {
  return this.findByIdAndUpdate(
    'categories',
    {
      categories: categories,
      lastUpdated: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Save geographic options to cache
 */
trendlyOptionsSchema.statics.saveGeographic = async function(geoData) {
  return this.findByIdAndUpdate(
    'geographic',
    {
      geo: geoData,
      lastUpdated: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('TrendlyOptions', trendlyOptionsSchema);
