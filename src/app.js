const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
// const rateLimit = require('express-rate-limit'); // DISABLED FOR TESTING
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

// Import custom middleware
const globalErrorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/appError');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const videoRoutes = require('./routes/videos');
const socialRoutes = require('./routes/social');
const postRoutes = require('./routes/posts');
const aiRoutes = require('./routes/ai');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const legalRoutes = require('./routes/legal');
const configRoutes = require('./routes/config');

// Create Express app
const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Global Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: message => logger.info(message) } }));
}

// Rate limiting - DISABLED FOR TESTING
// const limiter = rateLimit({
//   max: 100, // limit each IP to 100 requests per windowMs
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   message: 'Too many requests from this IP, please try again in an hour!',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (for MVP - serve uploaded files)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Enhanced Swagger UI with custom styling
const customCss = `
  .swagger-ui .topbar { display: none !important; }
  .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .swagger-ui .info { margin: 50px 0; }
  .swagger-ui .info .title { 
    color: #1f2937; 
    font-size: 2.5rem; 
    font-weight: 700; 
    margin-bottom: 20px;
  }
  .swagger-ui .info .description { 
    color: #374151; 
    font-size: 1rem; 
    line-height: 1.6; 
    max-width: none;
  }
  .swagger-ui .info .description h1 { 
    color: #111827; 
    font-size: 1.8rem; 
    margin: 30px 0 15px 0;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 10px;
  }
  .swagger-ui .info .description h2 { 
    color: #1f2937; 
    font-size: 1.4rem; 
    margin: 25px 0 12px 0;
  }
  .swagger-ui .info .description ul { 
    margin: 15px 0; 
    padding-left: 20px;
  }
  .swagger-ui .info .description li { 
    margin: 8px 0; 
    color: #4b5563;
  }
  .swagger-ui .info .description code { 
    background: #f3f4f6; 
    padding: 2px 6px; 
    border-radius: 4px; 
    font-family: 'Monaco', 'Consolas', monospace;
    color: #dc2626;
  }
  .swagger-ui .scheme-container { 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
    padding: 20px; 
    border-radius: 8px; 
    margin: 20px 0;
  }
  .swagger-ui .authorization__btn { 
    background: #10b981; 
    border-color: #10b981;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .swagger-ui .authorization__btn:hover { 
    background: #059669; 
    border-color: #059669;
  }
  .swagger-ui .opblock.opblock-post { 
    border-color: #10b981; 
    background: rgba(16, 185, 129, 0.05);
  }
  .swagger-ui .opblock.opblock-post .opblock-summary { 
    border-color: #10b981; 
  }
  .swagger-ui .opblock.opblock-get { 
    border-color: #3b82f6; 
    background: rgba(59, 130, 246, 0.05);
  }
  .swagger-ui .opblock.opblock-get .opblock-summary { 
    border-color: #3b82f6; 
  }
  .swagger-ui .opblock.opblock-patch { 
    border-color: #f59e0b; 
    background: rgba(245, 158, 11, 0.05);
  }
  .swagger-ui .opblock.opblock-patch .opblock-summary { 
    border-color: #f59e0b; 
  }
  .swagger-ui .opblock.opblock-delete { 
    border-color: #ef4444; 
    background: rgba(239, 68, 68, 0.05);
  }
  .swagger-ui .opblock.opblock-delete .opblock-summary { 
    border-color: #ef4444; 
  }
  .swagger-ui .opblock-tag { 
    color: #111827; 
    font-size: 1.5rem; 
    font-weight: 600; 
    margin: 40px 0 20px 0;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 10px;
  }
  .swagger-ui .btn.execute { 
    background: #6366f1; 
    border-color: #6366f1;
    color: white;
    font-weight: 600;
    border-radius: 6px;
    padding: 8px 16px;
  }
  .swagger-ui .btn.execute:hover { 
    background: #4f46e5; 
    border-color: #4f46e5;
  }
  .swagger-ui .parameter__name { 
    font-weight: 600; 
    color: #374151;
  }
  .swagger-ui .response-col_status { 
    font-weight: 600;
  }
  .swagger-ui .model-box { 
    background: #f8fafc; 
    border: 1px solid #e2e8f0; 
    border-radius: 6px;
  }
  .swagger-ui select { 
    border-radius: 4px; 
    border: 1px solid #d1d5db;
  }
  .swagger-ui input[type="text"], .swagger-ui textarea { 
    border-radius: 4px; 
    border: 1px solid #d1d5db;
  }
  .swagger-ui .info .description a { 
    color: #3b82f6; 
    text-decoration: none; 
    font-weight: 500;
  }
  .swagger-ui .info .description a:hover { 
    color: #1d4ed8; 
    text-decoration: underline;
  }
`;

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: customCss,
  customSiteTitle: "🎬 Video Editing & Social Media API - Interactive Documentation",
  customfavIcon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzY2NmVlYSIvPgo8cGF0aCBkPSJNMTIgMTBMMjIgMTZMMTIgMjJWMTBaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    validatorUrl: null,
    syntaxHighlight: {
      activate: true,
      theme: 'arta'
    },
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayOperationId: false,
    showMutatedRequest: true,
    deepLinking: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha'
  }
}));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/social', socialRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/legal', legalRoutes);
app.use('/api/v1/config', configRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Documentation redirect
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;