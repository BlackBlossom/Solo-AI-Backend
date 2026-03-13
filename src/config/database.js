const mongoose = require('mongoose');
const configService = require('../services/configService');

const connectDB = async () => {
  try {
    // Try to get database URI from settings (DB has priority over ENV)
    let databaseUri = process.env.DATABASE_URI;
    
    try {
      const settings = await configService.getSettings();
      // DB credentials take priority over environment variables
      databaseUri = settings.mongodb?.uri || process.env.DATABASE_URI;
    } catch (error) {
      console.log('Using DATABASE_URI from environment variables (DB not yet initialized)');
    }
    
    const conn = await mongoose.connect(databaseUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;