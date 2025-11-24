const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

// Load environment variables
dotenv.config();

// Track server start time for uptime calculation
global.serverStartTime = Date.now();

// Import app
const app = require('./src/app');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DATABASE_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize services after database connection
    await initializeServices();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Initialize application services
const initializeServices = async () => {
  try {
    console.log('📧 Initializing services...');
    
    // Initialize email service
    const emailService = require('./src/services/emailService');
    await emailService.initialize();
    
    // Initialize Cloudinary
    const { initializeCloudinary } = require('./src/services/cloudinaryService');
    await initializeCloudinary();
    
    // Initialize Bundle.social config
    const { updateConfigFromDatabase } = require('./src/config/bundleSocial');
    await updateConfigFromDatabase();
    
    // Initialize trending keywords service (RapidAPI)
    const trendingService = require('./src/services/trendingService');
    await trendingService.initialize();
    
    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('⚠️  Service initialization failed:', error.message);
    console.log('Services will fall back to environment variables');
  }
};

// Connect to database
connectDB();

// Start server
const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`🚀 Server running on port ${port} in ${process.env.NODE_ENV} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});