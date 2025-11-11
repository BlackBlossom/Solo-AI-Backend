const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');
const Media = require('../models/Media');
const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const SocialAccount = require('../models/SocialAccount');
const AdminActivityLog = require('../models/AdminActivityLog');
const Settings = require('../models/Settings');
const cloudinaryService = require('../services/cloudinaryService');
const { 
  sendSuccess, 
  sendCreated, 
  sendBadRequest, 
  sendUnauthorized, 
  sendNotFound,
  sendError,
  getPaginationMeta
} = require('../utils/response');
const logger = require('../utils/logger');

// ==================== AUTH ====================

/**
 * Generate admin JWT token
 */
const signToken = (id) => {
  return jwt.sign({ id }, process.env.ADMIN_JWT_SECRET, {
    expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '1d'
  });
};

/**
 * Generate admin refresh token
 */
const signRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.ADMIN_JWT_REFRESH_SECRET, {
    expiresIn: process.env.ADMIN_JWT_REFRESH_EXPIRES_IN || '7d'
  });
};

/**
 * Admin login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return sendBadRequest(res, 'Please provide email and password');
    }

    // Find admin with password
    const admin = await AdminUser.findOne({ email }).select('+password');

    // Check credentials
    if (!admin || !(await admin.correctPassword(password, admin.password))) {
      // Increment login attempts if admin exists
      if (admin) {
        await admin.incLoginAttempts();
      }
      return sendUnauthorized(res, 'Incorrect email or password');
    }

    // Check if admin is active
    if (!admin.isActive) {
      return sendError(res, 403, 'Your admin account has been deactivated');
    }

    // Check if account is locked
    if (admin.isLocked) {
      return sendUnauthorized(res, 'Account is temporarily locked due to too many failed login attempts');
    }

    // Reset login attempts on successful login
    if (admin.loginAttempts > 0) {
      await admin.resetLoginAttempts();
    }

    // Update last login
    admin.lastLoginAt = Date.now();

    // Generate tokens
    const accessToken = signToken(admin._id);
    const refreshToken = signRefreshToken(admin._id);

    // Store refresh token
    admin.refreshToken = refreshToken;
    admin.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await admin.save({ validateBeforeSave: false });

    // Log activity
    await AdminActivityLog.create({
      admin: admin._id,
      action: 'login',
      resourceType: 'admin',
      details: { method: 'login' },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      success: true
    });

    // Remove sensitive data
    admin.password = undefined;
    admin.refreshToken = undefined;

    logger.info('Admin logged in successfully:', { adminId: admin._id, email: admin.email });

    sendSuccess(res, 'Login successful', {
      token: accessToken,
      refreshToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    next(error);
  }
};

/**
 * Refresh admin token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return sendBadRequest(res, 'Refresh token is required');
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ADMIN_JWT_REFRESH_SECRET);
    } catch (error) {
      return sendUnauthorized(res, 'Invalid or expired refresh token');
    }

    // Find admin
    const admin = await AdminUser.findById(decoded.id);
    if (!admin || admin.refreshToken !== token) {
      return sendUnauthorized(res, 'Invalid refresh token');
    }

    // Check expiry
    if (admin.refreshTokenExpires && admin.refreshTokenExpires < new Date()) {
      return sendUnauthorized(res, 'Refresh token has expired');
    }

    // Generate new tokens
    const newAccessToken = signToken(admin._id);
    const newRefreshToken = signRefreshToken(admin._id);

    admin.refreshToken = newRefreshToken;
    admin.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await admin.save({ validateBeforeSave: false });

    logger.info('Admin tokens refreshed:', { adminId: admin._id });

    sendSuccess(res, 'Tokens refreshed successfully', {
      token: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Admin refresh token error:', error);
    next(error);
  }
};

// ==================== DASHBOARD ====================

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (req, res, next) => {
  // Start timing for API response
  const apiStartTime = Date.now();
  
  try {
    // Start timing for database queries
    const dbStartTime = Date.now();
    
    const [
      totalUsers,
      totalVideos,
      totalPosts,
      totalMedia,
      totalSocialAccounts,
      recentUsers,
      recentVideos,
      recentPosts
    ] = await Promise.all([
      User.countDocuments(),
      Video.countDocuments(),
      Post.countDocuments(),
      Media.countDocuments(),
      SocialAccount.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email createdAt loginType'),
      Video.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name email'),
      Post.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name email').populate('video', 'thumbnailUrl')
    ]);

    // Calculate database response time
    const dbResponseTime = Date.now() - dbStartTime;

    // Get user growth (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Calculate API response time
    const apiResponseTime = Date.now() - apiStartTime;

    // Calculate server uptime
    const serverStartTime = global.serverStartTime || Date.now();
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // in seconds

    // Get database connection status
    const dbConnectionStatus = mongoose.connection.readyState === 1 ? 'connected' : 
                               mongoose.connection.readyState === 2 ? 'connecting' :
                               mongoose.connection.readyState === 3 ? 'disconnecting' : 'disconnected';

    // Get memory usage (optional)
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100, // Resident Set Size
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100
    };

    // Get CPU usage (optional - simple calculation)
    const cpuUsage = process.cpuUsage();

    sendSuccess(res, 'Dashboard stats retrieved successfully', {
      stats: {
        totalUsers,
        totalVideos,
        totalPosts,
        totalMedia,
        totalSocialAccounts,
        newUsersThisMonth
      },
      recent: {
        users: recentUsers,
        videos: recentVideos,
        posts: recentPosts
      },
      systemHealth: {
        api: {
          responseTime: apiResponseTime,
          lastResponseTime: apiResponseTime
        },
        database: {
          responseTime: dbResponseTime,
          lastQueryTime: dbResponseTime,
          connectionStatus: dbConnectionStatus
        },
        server: {
          uptime: uptime,
          startTime: new Date(serverStartTime).toISOString(),
          memoryUsage: memoryUsageMB,
          cpuUsage: {
            user: cpuUsage.user,
            system: cpuUsage.system
          }
        }
      }
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    next(error);
  }
};

// ==================== MEDIA MANAGEMENT ====================

/**
 * Get all media with pagination and filters
 */
const getAllMedia = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      category, 
      search,
      isActive,
      folder, // New: filter by Cloudinary folder (images, stickers, gifs, audio, fonts)
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (type) {
      // Support multiple types: ?type=image,sticker,gif
      const types = type.split(',').map(t => t.trim());
      query.type = types.length === 1 ? types[0] : { $in: types };
    }
    
    if (category) {
      // Support multiple categories: ?category=overlay,effect
      const categories = category.split(',').map(c => c.trim());
      query.category = categories.length === 1 ? categories[0] : { $in: categories };
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Filter by Cloudinary folder (maps to media type)
    if (folder) {
      const folderMap = {
        'images': 'image',
        'stickers': 'sticker',
        'gifs': 'gif',
        'audio': 'audio',
        'fonts': 'font'
      };
      
      const folders = folder.split(',').map(f => f.trim());
      const mappedTypes = folders.map(f => folderMap[f]).filter(Boolean);
      
      if (mappedTypes.length > 0) {
        query.type = mappedTypes.length === 1 ? mappedTypes[0] : { $in: mappedTypes };
      }
    }

    // Search across title, description, and tags
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [media, total] = await Promise.all([
      Media.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('uploadedBy', 'name email'),
      Media.countDocuments(query)
    ]);

    // Get counts by folder/type for UI
    const folderCounts = await Media.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const counts = {
      images: folderCounts.find(f => f._id === 'image')?.count || 0,
      stickers: folderCounts.find(f => f._id === 'sticker')?.count || 0,
      gifs: folderCounts.find(f => f._id === 'gif')?.count || 0,
      audio: folderCounts.find(f => f._id === 'audio')?.count || 0,
      fonts: folderCounts.find(f => f._id === 'font')?.count || 0,
      total: folderCounts.reduce((sum, f) => sum + f.count, 0)
    };

    sendSuccess(res, 'Media retrieved successfully', {
      media,
      counts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get all media error:', error);
    next(error);
  }
};

/**
 * Get single media by ID
 */
const getMedia = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id).populate('uploadedBy', 'name email');

    if (!media) {
      return sendNotFound(res, 'Media not found');
    }

    sendSuccess(res, 'Media retrieved successfully', { media });
  } catch (error) {
    logger.error('Get media error:', error);
    next(error);
  }
};

/**
 * Create/upload new media
 */
/**
 * Upload new media to Cloudinary
 */
const createMedia = async (req, res, next) => {
  try {
    // Validate file upload
    if (!req.file) {
      return sendBadRequest(res, 'No file uploaded. Please select a file to upload');
    }

    // Validate required fields
    const { title, type, category } = req.body;
    
    if (!title || !title.trim()) {
      return sendBadRequest(res, 'Title is required');
    }
    
    if (!type) {
      return sendBadRequest(res, 'Media type is required (image, sticker, gif, or audio)');
    }
    
    if (!category) {
      return sendBadRequest(res, 'Category is required');
    }

    // Validate type and category
    const validTypes = ['image', 'sticker', 'gif', 'audio', 'font'];
    const validCategories = ['overlay', 'effect', 'transition', 'music', 'soundfx', 'filter', 'background', 'template', 'typography', 'other'];
    
    if (!validTypes.includes(type)) {
      return sendBadRequest(res, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }
    
    if (!validCategories.includes(category)) {
      return sendBadRequest(res, `Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }

    // Validate file type
    if (!cloudinaryService.isValidFileType(req.file.mimetype)) {
      return sendBadRequest(res, `Invalid file type: ${req.file.mimetype}. Only images (JPEG, PNG, GIF, WebP, SVG), audio files (MP3, WAV, OGG, M4A), videos (MP4, MOV, AVI, WebM, MKV), and fonts (TTF, OTF, WOFF, WOFF2) are allowed`);
    }

    // Check if video is being uploaded as GIF
    const isVideoToGif = req.file.mimetype.startsWith('video/');
    if (isVideoToGif && type !== 'gif') {
      return sendBadRequest(res, 'Videos can only be uploaded with type "gif" as they will be converted to animated GIFs');
    }

    // Check if font file matches font type
    const isFontFile = cloudinaryService.isFontFile(req.file.mimetype, req.file.originalname);
    if (isFontFile && type !== 'font') {
      return sendBadRequest(res, 'Font files can only be uploaded with type "font"');
    }

    if (type === 'font' && !isFontFile) {
      return sendBadRequest(res, 'Type "font" requires a font file (TTF, OTF, WOFF, WOFF2)');
    }

    // Validate sticker type (should have transparency)
    if (type === 'sticker' && !['image/png', 'image/webp', 'image/svg+xml'].includes(req.file.mimetype)) {
      return sendBadRequest(res, 'Stickers should be PNG, WebP, or SVG format for transparency support');
    }

    // Parse tags if string
    const { description, tags } = req.body;
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {
        parsedTags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
      }
    }

    // Upload to Cloudinary
    logger.info('Uploading file to Cloudinary...', { 
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      type: type,
      isVideoToGif: req.file.mimetype.startsWith('video/'),
      isFont: type === 'font',
      adminId: req.admin._id 
    });

    const uploadResult = await cloudinaryService.uploadToCloudinary(req.file, {
      prefix: `${type}-${category}`,
      type: type // Pass type to service for proper folder organization
    });

    if (!uploadResult.success) {
      return sendError(res, 500, 'Failed to upload file to Cloudinary');
    }

    // Create media record in database
    const media = await Media.create({
      title: title.trim(),
      description: description?.trim() || '',
      type,
      category,
      tags: parsedTags,
      cloudinaryUrl: uploadResult.url,
      cloudinaryPublicId: uploadResult.publicId,
      cloudinaryFolder: uploadResult.folder,
      fileSize: uploadResult.bytes,
      mimeType: uploadResult.format === 'gif' && req.file.mimetype.startsWith('video/') 
        ? 'image/gif' // Store as GIF mimetype if converted from video
        : req.file.mimetype,
      dimensions: {
        width: uploadResult.width || 0,
        height: uploadResult.height || 0
      },
      duration: uploadResult.duration || 0,
      uploadedBy: req.admin._id
    });

    logger.info('Media created successfully:', { 
      mediaId: media._id, 
      title: media.title,
      type: media.type,
      originalFormat: req.file.mimetype,
      finalFormat: uploadResult.format,
      cloudinaryUrl: media.cloudinaryUrl,
      adminId: req.admin._id 
    });

    const successMessage = req.file.mimetype.startsWith('video/')
      ? 'Video uploaded and converted to GIF successfully'
      : type === 'font'
      ? 'Font uploaded successfully'
      : 'Media uploaded successfully';

    sendCreated(res, successMessage, { media });
  } catch (error) {
    logger.error('Create media error:', { 
      message: error.message,
      stack: error.stack,
      adminId: req.admin?._id 
    });

    // Check if it's a Cloudinary error
    if (error.message.includes('Cloudinary') || error.message.includes('upload')) {
      return sendError(res, 500, `Upload failed: ${error.message}`);
    }

    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return sendBadRequest(res, `Validation error: ${messages.join(', ')}`);
    }

    next(error);
  }
};

/**
 * Update media metadata
 */
const updateMedia = async (req, res, next) => {
  try {
    const { title, description, category, tags, isActive } = req.body;

    const media = await Media.findById(req.params.id);
    
    if (!media) {
      return sendNotFound(res, 'Media not found');
    }

    // Update fields
    if (title !== undefined) media.title = title;
    if (description !== undefined) media.description = description;
    if (category !== undefined) media.category = category;
    if (tags !== undefined) media.tags = Array.isArray(tags) ? tags : [tags];
    if (isActive !== undefined) media.isActive = isActive;

    await media.save();

    logger.info('Media updated:', { mediaId: media._id, adminId: req.admin._id });

    sendSuccess(res, 'Media updated successfully', { media });
  } catch (error) {
    logger.error('Update media error:', error);
    next(error);
  }
};

/**
 * Toggle media active status
 */
const toggleMediaStatus = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    
    if (!media) {
      return sendNotFound(res, 'Media not found');
    }

    media.isActive = !media.isActive;
    await media.save();

    logger.info('Media status toggled:', { mediaId: media._id, isActive: media.isActive, adminId: req.admin._id });

    sendSuccess(res, `Media ${media.isActive ? 'activated' : 'deactivated'} successfully`, { media });
  } catch (error) {
    logger.error('Toggle media status error:', error);
    next(error);
  }
};

/**
 * Delete single media
 */
const deleteMedia = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);

    if (!media) {
      return sendNotFound(res, 'Media not found');
    }

    // Determine resource type
    const resourceType = cloudinaryService.getResourceType(media.mimeType || 'image/jpeg');

    // Delete from Cloudinary
    try {
      await cloudinaryService.deleteFromCloudinary(media.cloudinaryPublicId, resourceType);
      logger.info('File deleted from Cloudinary:', { publicId: media.cloudinaryPublicId });
    } catch (cloudinaryError) {
      logger.warn('Failed to delete from Cloudinary, but will delete from database:', { 
        publicId: media.cloudinaryPublicId,
        error: cloudinaryError.message 
      });
      // Continue with database deletion even if Cloudinary fails
    }

    // Delete from database
    await media.deleteOne();

    logger.info('Media deleted:', { mediaId: media._id, title: media.title, adminId: req.admin._id });

    sendSuccess(res, 'Media deleted successfully');
  } catch (error) {
    logger.error('Delete media error:', { 
      message: error.message,
      mediaId: req.params.id,
      adminId: req.admin?._id 
    });
    next(error);
  }
};

/**
 * Bulk delete media
 */
const bulkDeleteMedia = async (req, res, next) => {
  try {
    const { ids } = req.body;

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendBadRequest(res, 'No media IDs provided. Please provide an array of media IDs to delete');
    }

    // Find media items
    const media = await Media.find({ _id: { $in: ids } });

    if (media.length === 0) {
      return sendNotFound(res, 'No media found with provided IDs');
    }

    // Group by resource type
    const imageIds = [];
    const audioIds = [];

    media.forEach(item => {
      const resourceType = cloudinaryService.getResourceType(item.mimeType || 'image/jpeg');
      if (resourceType === 'video') { // audio files
        audioIds.push(item.cloudinaryPublicId);
      } else {
        imageIds.push(item.cloudinaryPublicId);
      }
    });

    // Delete from Cloudinary
    let cloudinarySuccess = true;
    const deletePromises = [];
    
    if (imageIds.length > 0) {
      deletePromises.push(
        cloudinaryService.bulkDeleteFromCloudinary(imageIds, 'image')
          .catch(err => {
            logger.error('Failed to bulk delete images from Cloudinary:', err.message);
            cloudinarySuccess = false;
          })
      );
    }
    
    if (audioIds.length > 0) {
      deletePromises.push(
        cloudinaryService.bulkDeleteFromCloudinary(audioIds, 'video')
          .catch(err => {
            logger.error('Failed to bulk delete audio from Cloudinary:', err.message);
            cloudinarySuccess = false;
          })
      );
    }

    await Promise.allSettled(deletePromises);

    // Delete from database (even if Cloudinary fails)
    const deleteResult = await Media.deleteMany({ _id: { $in: ids } });

    logger.info('Bulk media deleted:', { 
      requested: ids.length,
      found: media.length,
      deleted: deleteResult.deletedCount,
      cloudinarySuccess,
      adminId: req.admin._id 
    });

    const message = cloudinarySuccess 
      ? `${deleteResult.deletedCount} media item(s) deleted successfully`
      : `${deleteResult.deletedCount} media item(s) deleted from database (some Cloudinary deletions may have failed)`;

    sendSuccess(res, message, { 
      deletedCount: deleteResult.deletedCount,
      cloudinarySuccess 
    });
  } catch (error) {
    logger.error('Bulk delete media error:', { 
      message: error.message,
      adminId: req.admin?._id 
    });
    next(error);
  }
};

// ==================== USER MANAGEMENT ====================

/**
 * Get all users with pagination and filters
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search,
      loginType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (loginType) query.loginType = loginType;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [users, total] = await Promise.all([
      User.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password -refreshToken'),
      User.countDocuments(query)
    ]);

    sendSuccess(res, 'Users retrieved successfully', {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get all users error:', error);
    next(error);
  }
};

/**
 * Get single user details
 */
const getUserDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshToken');

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    // Get related data counts
    const [videoCount, postCount] = await Promise.all([
      Video.countDocuments({ user: user._id }),
      Post.countDocuments({ user: user._id })
    ]);

    // Get social accounts
    const socialAccounts = await SocialAccount.find({ user: user._id });

    sendSuccess(res, 'User details retrieved successfully', {
      user,
      stats: {
        videos: videoCount,
        posts: postCount,
        socialAccounts: socialAccounts.length
      },
      socialAccounts
    });
  } catch (error) {
    logger.error('Get user details error:', error);
    next(error);
  }
};

/**
 * Ban/Unban user
 */
const banUser = async (req, res, next) => {
  try {
    const { status, reason, duration } = req.body; // status: 'active', 'banned', 'suspended'
    const user = await User.findById(req.params.id);

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    // Validate status
    const validStatuses = ['active', 'banned', 'suspended'];
    if (!validStatuses.includes(status)) {
      return sendBadRequest(res, 'Invalid status. Must be one of: active, banned, suspended');
    }

    // Update user status
    user.status = status;
    
    if (status === 'banned' || status === 'suspended') {
      // Set ban reason if provided
      user.banReason = reason || 'No reason provided';
      
      // Set ban expiry if duration is provided (in days)
      if (duration && duration > 0) {
        user.banExpiry = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
      } else {
        // Permanent ban - no expiry
        user.banExpiry = undefined;
      }
      
      // Also set lockUntil for backward compatibility
      user.lockUntil = user.banExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else {
      // Clear ban fields when reactivating
      user.banReason = undefined;
      user.banExpiry = undefined;
      user.lockUntil = undefined;
    }

    await user.save();

    const actionMessage = status === 'active' 
      ? 'unbanned/reactivated' 
      : status === 'banned' 
        ? 'banned' 
        : 'suspended';

    logger.info(`User ${actionMessage}:`, { 
      userId: user._id,
      newStatus: status,
      reason: reason || 'N/A',
      duration: duration ? `${duration} days` : 'permanent',
      adminId: req.admin._id 
    });

    sendSuccess(res, `User ${actionMessage} successfully`, { 
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        status: user.status,
        banReason: user.banReason,
        banExpiry: user.banExpiry
      }
    });
  } catch (error) {
    logger.error('Ban user error:', error);
    next(error);
  }
};

/**
 * Delete user account
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    // Delete related data
    await Promise.all([
      Video.deleteMany({ user: user._id }),
      Post.deleteMany({ user: user._id }),
      SocialAccount.deleteMany({ user: user._id })
    ]);

    // Delete user
    await user.deleteOne();

    logger.warn('User deleted by admin:', { userId: user._id, adminId: req.admin._id });

    sendSuccess(res, 'User and all related data deleted successfully');
  } catch (error) {
    logger.error('Delete user error:', error);
    next(error);
  }
};

// ==================== VIDEO MANAGEMENT ====================

/**
 * Get all videos
 */
const getAllVideos = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    if (status) query.status = status;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [videos, total] = await Promise.all([
      Video.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email'),
      Video.countDocuments(query)
    ]);

    sendSuccess(res, 'Videos retrieved successfully', {
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get all videos error:', error);
    next(error);
  }
};

/**
 * Delete video
 */
const deleteVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return sendNotFound(res, 'Video not found');
    }

    // Remove video ID from user's videos array
    const User = require('../models/User');
    await User.findByIdAndUpdate(
      video.user,
      { $pull: { videos: video._id } }, // $pull removes the video ID
      { new: true }
    );

    await video.deleteOne();

    logger.info('Video deleted by admin:', { 
      videoId: video._id, 
      adminId: req.admin._id,
      userId: video.user,
      removedFromUserProfile: true
    });

    sendSuccess(res, 'Video deleted successfully');
  } catch (error) {
    logger.error('Delete video error:', error);
    next(error);
  }
};

// ==================== POST MANAGEMENT ====================

/**
 * Get all posts
 */
const getAllPosts = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      bundleStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    if (bundleStatus) query.bundleStatus = bundleStatus;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email')
        .populate('video', 'title thumbnailUrl'),
      Post.countDocuments(query)
    ]);

    sendSuccess(res, 'Posts retrieved successfully', {
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get all posts error:', error);
    next(error);
  }
};

/**
 * Delete post
 */
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return sendNotFound(res, 'Post not found');
    }

    // Remove post ID from user's posts array
    const User = require('../models/User');
    await User.findByIdAndUpdate(
      post.user,
      { $pull: { posts: post._id } }, // $pull removes the post ID
      { new: true }
    );

    await post.deleteOne();

    logger.info('Post deleted by admin:', { 
      postId: post._id, 
      adminId: req.admin._id,
      userId: post.user,
      removedFromUserProfile: true
    });

    sendSuccess(res, 'Post deleted successfully');
  } catch (error) {
    logger.error('Delete post error:', error);
    next(error);
  }
};

// ==================== ANALYTICS ====================

/**
 * Get analytics overview
 */
const getAnalyticsOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query = dateFilter.$gte || dateFilter.$lte ? { createdAt: dateFilter } : {};

    const [
      userStats,
      videoStats,
      postStats,
      socialAccountStats
    ] = await Promise.all([
      User.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$loginType',
            count: { $sum: 1 }
          }
        }
      ]),
      Video.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Post.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$bundleStatus',
            count: { $sum: 1 }
          }
        }
      ]),
      SocialAccount.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$platform',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    sendSuccess(res, 'Analytics overview retrieved', {
      users: userStats,
      videos: videoStats,
      posts: postStats,
      socialAccounts: socialAccountStats
    });
  } catch (error) {
    logger.error('Get analytics overview error:', error);
    next(error);
  }
};

/**
 * Get user analytics
 */
const getUserAnalytics = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    sendSuccess(res, 'User analytics retrieved', {
      period: `${days} days`,
      growth: userGrowth
    });
  } catch (error) {
    logger.error('Get user analytics error:', error);
    next(error);
  }
};

// ==================== SETTINGS ====================

/**
 * Get system settings
 */
const getSettings = async (req, res, next) => {
  try {
    const { disclosure = 'public' } = req.query;
    
    // Get settings from database
    let settings = await Settings.getSettings();
    
    // Return appropriate format based on disclosure level and role
    // disclosure options: 'public', 'masked', 'full'
    
    if (disclosure === 'full' && req.admin.role === 'superadmin') {
      // FULL DISCLOSURE: Superadmin can see actual secrets (unmasked)
      const fullSettings = settings.toFullJSON();
      logger.info('Settings retrieved with full disclosure', { adminId: req.admin._id });
      return sendSuccess(res, 'Settings retrieved successfully (full disclosure)', { 
        settings: fullSettings,
        disclosure: 'full',
        warning: '⚠️ This response contains sensitive secrets. Handle with care!'
      });
    } else if (disclosure === 'masked' && req.admin.role === 'superadmin') {
      // MASKED DISCLOSURE: Superadmin can see masked secrets (e.g., "sk_l••••••••2a3b")
      const maskedSettings = settings.toMaskedJSON();
      return sendSuccess(res, 'Settings retrieved successfully (masked secrets)', { 
        settings: maskedSettings,
        disclosure: 'masked'
      });
    } else {
      // PUBLIC: Regular response without any secrets (for all admin roles)
      const publicSettings = settings.toPublicJSON();
      
      // Log warning if non-superadmin tried to access secrets
      if ((disclosure === 'full' || disclosure === 'masked') && req.admin.role !== 'superadmin') {
        logger.warn('Non-superadmin attempted to access sensitive settings', { 
          adminId: req.admin._id, 
          role: req.admin.role,
          requestedDisclosure: disclosure
        });
      }
      
      return sendSuccess(res, 'Settings retrieved successfully', { 
        settings: publicSettings,
        disclosure: 'public'
      });
    }
  } catch (error) {
    logger.error('Get settings error:', { 
      message: error.message,
      stack: error.stack,
      adminId: req.admin?._id 
    });
    next(error);
  }
};

/**
 * Update system settings
 */
const updateSettings = async (req, res, next) => {
  try {
    const { 
      cloudinary,
      mongodb,
      email,
      videoUpload,
      apiKeys,
      urls,
      app,
      features
    } = req.body;

    // Build updates object
    const updates = {};
    
    if (cloudinary) {
      updates.cloudinary = {};
      if (cloudinary.cloudName !== undefined) updates.cloudinary.cloudName = cloudinary.cloudName;
      if (cloudinary.apiKey !== undefined) updates.cloudinary.apiKey = cloudinary.apiKey;
      if (cloudinary.apiSecret !== undefined) updates.cloudinary.apiSecret = cloudinary.apiSecret;
    }

    if (mongodb?.uri !== undefined) {
      updates.mongodb = { uri: mongodb.uri };
    }

    if (email) {
      updates.email = {};
      
      // Validate provider if specified
      if (email.provider !== undefined) {
        if (!['resend', 'smtp'].includes(email.provider)) {
          return sendBadRequest(res, 'Email provider must be either "resend" or "smtp"');
        }
        updates.email.provider = email.provider;
      }
      
      // Resend configuration
      if (email.resend) {
        updates.email.resend = {};
        if (email.resend.apiKey !== undefined) updates.email.resend.apiKey = email.resend.apiKey;
        if (email.resend.fromEmail !== undefined) updates.email.resend.fromEmail = email.resend.fromEmail;
        if (email.resend.fromName !== undefined) updates.email.resend.fromName = email.resend.fromName;
      }
      
      // SMTP configuration
      if (email.smtp) {
        updates.email.smtp = {};
        if (email.smtp.host !== undefined) updates.email.smtp.host = email.smtp.host;
        if (email.smtp.port !== undefined) updates.email.smtp.port = email.smtp.port;
        if (email.smtp.secure !== undefined) updates.email.smtp.secure = email.smtp.secure;
        if (email.smtp.user !== undefined) updates.email.smtp.user = email.smtp.user;
        if (email.smtp.pass !== undefined) updates.email.smtp.pass = email.smtp.pass;
        if (email.smtp.fromEmail !== undefined) updates.email.smtp.fromEmail = email.smtp.fromEmail;
        if (email.smtp.fromName !== undefined) updates.email.smtp.fromName = email.smtp.fromName;
      }
    }

    if (videoUpload) {
      updates.videoUpload = {};
      if (videoUpload.maxFileSize !== undefined) {
        if (videoUpload.maxFileSize < 10 || videoUpload.maxFileSize > 500) {
          return sendBadRequest(res, 'Video max file size must be between 10 and 500 MB');
        }
        updates.videoUpload.maxFileSize = videoUpload.maxFileSize;
      }
      if (videoUpload.allowedFormats !== undefined) updates.videoUpload.allowedFormats = videoUpload.allowedFormats;
      if (videoUpload.uploadPath !== undefined) updates.videoUpload.uploadPath = videoUpload.uploadPath;
    }

    if (apiKeys) {
      updates.apiKeys = {};
      if (apiKeys.geminiApiKey !== undefined) updates.apiKeys.geminiApiKey = apiKeys.geminiApiKey;
      if (apiKeys.bundleSocialApiKey !== undefined) updates.apiKeys.bundleSocialApiKey = apiKeys.bundleSocialApiKey;
      if (apiKeys.bundleSocialOrgId !== undefined) updates.apiKeys.bundleSocialOrgId = apiKeys.bundleSocialOrgId;
    }

    if (urls) {
      updates.urls = {};
      if (urls.productionUrl !== undefined) updates.urls.productionUrl = urls.productionUrl;
      if (urls.frontendUrl !== undefined) updates.urls.frontendUrl = urls.frontendUrl;
    }

    if (app) {
      updates.app = {};
      if (app.name !== undefined) updates.app.name = app.name;
      if (app.description !== undefined) updates.app.description = app.description;
      if (app.supportEmail !== undefined) updates.app.supportEmail = app.supportEmail;
      if (app.maintenanceMode !== undefined) updates.app.maintenanceMode = app.maintenanceMode;
      if (app.allowNewRegistrations !== undefined) updates.app.allowNewRegistrations = app.allowNewRegistrations;
    }

    if (features) {
      updates.features = {};
      if (features.videoEditingEnabled !== undefined) updates.features.videoEditingEnabled = features.videoEditingEnabled;
      if (features.socialMediaIntegrationEnabled !== undefined) updates.features.socialMediaIntegrationEnabled = features.socialMediaIntegrationEnabled;
      if (features.aiAssistantEnabled !== undefined) updates.features.aiAssistantEnabled = features.aiAssistantEnabled;
      if (features.adminPanelEnabled !== undefined) updates.features.adminPanelEnabled = features.adminPanelEnabled;
    }

    // Update settings
    const settings = await Settings.updateSettings(updates, req.admin._id);

    // Invalidate config service cache
    const configService = require('../services/configService');
    configService.invalidateCache();

    // If Cloudinary settings changed, reconfigure
    if (cloudinary) {
      const { reconfigureCloudinary } = require('../services/cloudinaryService');
      await reconfigureCloudinary();
      logger.info('Cloudinary reconfigured with new settings');
    }

    // If email settings changed, reinitialize email service
    if (email) {
      const emailService = require('../services/emailService');
      await emailService.reinitialize();
      logger.info('Email service reinitialized with new settings');
    }

    // If Bundle.social settings changed, reconfigure
    if (apiKeys && (apiKeys.bundleSocialApiKey || apiKeys.bundleSocialOrgId)) {
      const { reconfigureBundleSocialAPI } = require('../config/bundleSocial');
      await reconfigureBundleSocialAPI();
      logger.info('Bundle.social API reconfigured with new settings');
    }

    logger.info('Settings updated successfully:', { 
      updatedFields: Object.keys(updates),
      adminId: req.admin._id 
    });

    const publicSettings = settings.toPublicJSON();
    sendSuccess(res, 'Settings updated successfully', { settings: publicSettings });
  } catch (error) {
    logger.error('Update settings error:', { 
      message: error.message,
      stack: error.stack,
      adminId: req.admin?._id 
    });
    next(error);
  }
};

// ==================== ACTIVITY LOGS ====================

/**
 * Get activity logs
 */
const getActivityLogs = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      action,
      resourceType,
      adminId
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;
    if (adminId) query.admin = adminId;

    const [logs, total] = await Promise.all([
      AdminActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('admin', 'name email role'),
      AdminActivityLog.countDocuments(query)
    ]);

    sendSuccess(res, 'Activity logs retrieved successfully', {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get activity logs error:', error);
    next(error);
  }
};

// ==================== ADMIN MANAGEMENT (SUPERADMIN ONLY) ====================

// Get all admin users
const getAllAdmins = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      role,
      isActive,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Filters
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [admins, total] = await Promise.all([
      AdminUser.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password -refreshToken')
        .populate('createdBy', 'name email'),
      AdminUser.countDocuments(query)
    ]);

    sendSuccess(res, 'Admins retrieved successfully', {
      admins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get all admins error:', error);
    next(error);
  }
};

// Create new admin user
const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role, permissions } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return sendError(res, 400, 'Name, email, and password are required');
    }

    // Validate role
    const validRoles = ['superadmin', 'admin', 'moderator'];
    if (role && !validRoles.includes(role)) {
      return sendError(res, 400, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Validate permissions
    const validPermissions = ['users', 'media', 'videos', 'posts', 'analytics', 'settings', 'socialaccounts'];
    if (permissions && Array.isArray(permissions)) {
      const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
      if (invalidPerms.length > 0) {
        return sendError(res, 400, `Invalid permissions: ${invalidPerms.join(', ')}`);
      }
    }

    // Check if email already exists
    const existingAdmin = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return sendError(res, 400, 'An admin with this email already exists');
    }

    // Create new admin
    const admin = await AdminUser.create({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'admin',
      permissions: permissions || [],
      createdBy: req.admin._id,
      isActive: true
    });

    // Log activity
    await AdminActivityLog.create({
      admin: req.admin._id,
      action: 'create',
      resourceType: 'admin',
      resourceId: admin._id,
      details: {
        adminName: admin.name,
        adminEmail: admin.email,
        adminRole: admin.role
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Remove password from response
    admin.password = undefined;

    logger.info('New admin created:', {
      createdBy: req.admin.email,
      newAdmin: admin.email,
      role: admin.role
    });

    sendSuccess(res, 'Admin created successfully', { admin }, null, 201);
  } catch (error) {
    logger.error('Create admin error:', error);
    next(error);
  }
};

// Update admin details
const updateAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, permissions, isActive } = req.body;

    // Find admin
    const admin = await AdminUser.findById(id);
    if (!admin) {
      return sendNotFound(res, 'Admin not found');
    }

    // Prevent superadmin from being modified by another superadmin (unless it's themselves)
    if (admin.role === 'superadmin' && admin._id.toString() !== req.admin._id.toString()) {
      return sendError(res, 403, 'Cannot modify another superadmin account');
    }

    // Update fields
    if (name) admin.name = name;
    if (email) {
      // Check if email is already taken
      const existingAdmin = await AdminUser.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: id }
      });
      if (existingAdmin) {
        return sendError(res, 400, 'Email is already in use');
      }
      admin.email = email.toLowerCase();
    }

    if (role) {
      const validRoles = ['superadmin', 'admin', 'moderator'];
      if (!validRoles.includes(role)) {
        return sendError(res, 400, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }
      admin.role = role;
    }

    if (permissions !== undefined) {
      const validPermissions = ['users', 'media', 'videos', 'posts', 'analytics', 'settings', 'socialaccounts'];
      if (Array.isArray(permissions)) {
        const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
        if (invalidPerms.length > 0) {
          return sendError(res, 400, `Invalid permissions: ${invalidPerms.join(', ')}`);
        }
        admin.permissions = permissions;
      }
    }

    if (isActive !== undefined) {
      admin.isActive = isActive;
    }

    await admin.save();

    // Log activity
    await AdminActivityLog.create({
      admin: req.admin._id,
      action: 'update',
      resourceType: 'admin',
      resourceId: admin._id,
      details: {
        adminName: admin.name,
        adminEmail: admin.email,
        changes: { name, email, role, permissions, isActive }
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    admin.password = undefined;

    logger.info('Admin updated:', {
      updatedBy: req.admin.email,
      admin: admin.email
    });

    sendSuccess(res, 'Admin updated successfully', { admin });
  } catch (error) {
    logger.error('Update admin error:', error);
    next(error);
  }
};

// Delete admin user
const deleteAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find admin
    const admin = await AdminUser.findById(id);
    if (!admin) {
      return sendNotFound(res, 'Admin not found');
    }

    // Prevent deletion of superadmin
    if (admin.role === 'superadmin') {
      return sendError(res, 403, 'Cannot delete superadmin account');
    }

    // Prevent self-deletion
    if (admin._id.toString() === req.admin._id.toString()) {
      return sendError(res, 403, 'Cannot delete your own account');
    }

    // Log activity before deletion
    await AdminActivityLog.create({
      admin: req.admin._id,
      action: 'delete',
      resourceType: 'admin',
      resourceId: admin._id,
      details: {
        adminName: admin.name,
        adminEmail: admin.email,
        adminRole: admin.role
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await AdminUser.findByIdAndDelete(id);

    logger.info('Admin deleted:', {
      deletedBy: req.admin.email,
      deletedAdmin: admin.email
    });

    sendSuccess(res, 'Admin deleted successfully');
  } catch (error) {
    logger.error('Delete admin error:', error);
    next(error);
  }
};

// Restrict/unrestrict admin (toggle isActive)
const restrictAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, reason } = req.body;

    if (isActive === undefined) {
      return sendError(res, 400, 'isActive field is required');
    }

    // Find admin
    const admin = await AdminUser.findById(id);
    if (!admin) {
      return sendNotFound(res, 'Admin not found');
    }

    // Prevent restriction of superadmin
    if (admin.role === 'superadmin') {
      return sendError(res, 403, 'Cannot restrict superadmin account');
    }

    // Prevent self-restriction
    if (admin._id.toString() === req.admin._id.toString()) {
      return sendError(res, 403, 'Cannot restrict your own account');
    }

    admin.isActive = isActive;
    await admin.save();

    // Log activity
    await AdminActivityLog.create({
      admin: req.admin._id,
      action: isActive ? 'unrestrict' : 'restrict',
      resourceType: 'admin',
      resourceId: admin._id,
      details: {
        adminName: admin.name,
        adminEmail: admin.email,
        isActive,
        reason: reason || 'No reason provided'
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    logger.info(`Admin ${isActive ? 'unrestricted' : 'restricted'}:`, {
      by: req.admin.email,
      admin: admin.email,
      reason
    });

    sendSuccess(res, `Admin ${isActive ? 'activated' : 'deactivated'} successfully`, { 
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        isActive: admin.isActive
      }
    });
  } catch (error) {
    logger.error('Restrict admin error:', error);
    next(error);
  }
};

/**
 * Update contact emails (support and report problem emails)
 */
const updateContactEmails = async (req, res, next) => {
  try {
    const { supportEmail, reportProblemEmail } = req.body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (supportEmail && !emailRegex.test(supportEmail)) {
      return sendBadRequest(res, 'Invalid support email format');
    }
    
    if (reportProblemEmail && !emailRegex.test(reportProblemEmail)) {
      return sendBadRequest(res, 'Invalid report problem email format');
    }

    // Get current settings
    const settings = await Settings.getSettings();

    // Update only the provided emails
    if (supportEmail !== undefined) {
      settings.app.supportEmail = supportEmail;
    }
    
    if (reportProblemEmail !== undefined) {
      settings.app.reportProblemEmail = reportProblemEmail;
    }

    settings.lastUpdatedBy = req.admin._id;
    settings.lastUpdatedAt = new Date();
    
    await settings.save();

    logger.info('Contact emails updated', {
      adminId: req.admin._id,
      supportEmail: supportEmail || 'not changed',
      reportProblemEmail: reportProblemEmail || 'not changed'
    });

    return sendSuccess(res, 'Contact emails updated successfully', {
      contactEmails: {
        supportEmail: settings.app.supportEmail,
        reportProblemEmail: settings.app.reportProblemEmail
      }
    });
  } catch (error) {
    logger.error('Update contact emails error:', error);
    next(error);
  }
};

module.exports = {
  // Auth
  login,
  refreshToken,
  // Dashboard
  getDashboardStats,
  // Media
  getAllMedia,
  getMedia,
  createMedia,
  updateMedia,
  toggleMediaStatus,
  deleteMedia,
  bulkDeleteMedia,
  // Users
  getAllUsers,
  getUserDetails,
  banUser,
  deleteUser,
  // Videos
  getAllVideos,
  deleteVideo,
  // Posts
  getAllPosts,
  deletePost,
  // Analytics
  getAnalyticsOverview,
  getUserAnalytics,
  // Settings
  getSettings,
  updateSettings,
  updateContactEmails,
  // Activity Logs
  getActivityLogs,
  // Admin Management (Superadmin only)
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  restrictAdmin
};
