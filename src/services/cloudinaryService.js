const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const configService = require('./configService');

// Initialize Cloudinary configuration from environment variables (will be overridden by database settings)
let cloudinaryConfigured = false;

/**
 * Initialize or reconfigure Cloudinary with settings from database
 */
const initializeCloudinary = async () => {
  try {
    const cloudinaryConfig = await configService.getCloudinaryConfig();
    
    if (!cloudinaryConfig.cloudName || !cloudinaryConfig.apiKey || !cloudinaryConfig.apiSecret) {
      logger.warn('Cloudinary configuration incomplete. Using environment variables as fallback.');
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    } else {
      cloudinary.config({
        cloud_name: cloudinaryConfig.cloudName,
        api_key: cloudinaryConfig.apiKey,
        api_secret: cloudinaryConfig.apiSecret
      });
      logger.info('Cloudinary configured from database settings');
    }
    
    cloudinaryConfigured = true;
  } catch (error) {
    logger.error('Failed to configure Cloudinary from database:', error.message);
    // Fallback to environment variables
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    cloudinaryConfigured = true;
  }
};

/**
 * Reconfigure Cloudinary (call after settings update)
 */
const reconfigureCloudinary = async () => {
  logger.info('Reconfiguring Cloudinary with updated settings...');
  cloudinaryConfigured = false;
  await initializeCloudinary();
};

// Initialize on module load
initializeCloudinary();

/**
 * Upload file to Cloudinary
 * @param {Object} file - File object from multer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = async (file, options = {}) => {
  try {
    // Validate file
    if (!file) {
      throw new Error('No file provided for upload');
    }

    // Determine folder and resource type based on media type or file mimetype
    let folder = options.folder || 'solo-ai/media'; // Allow custom folder from options
    let resourceType = 'auto';
    let allowedFormats = [];
    let transformation = [
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ];

    // Use type from options if provided (from controller)
    const mediaType = options.type;

    // Only set folder based on type if custom folder not provided
    if (!options.folder && mediaType === 'image') {
      folder = 'solo-ai/images';
      allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
      resourceType = 'image';
    } else if (!options.folder && mediaType === 'sticker') {
      folder = 'solo-ai/stickers';
      allowedFormats = ['png', 'webp', 'svg']; // Stickers usually need transparency
      resourceType = 'image';
    } else if (!options.folder && mediaType === 'gif') {
      folder = 'solo-ai/gifs';
      resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      
      // If it's a video being converted to GIF
      if (file.mimetype.startsWith('video/')) {
        transformation = [
          { width: 800, crop: 'scale' },
          { quality: 'auto' },
          { format: 'gif' },
          { flags: 'animated' },
          { fps: 15 }
        ];
        allowedFormats = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
      } else {
        allowedFormats = ['gif'];
      }
    } else if (!options.folder && mediaType === 'audio') {
      folder = 'solo-ai/audio';
      allowedFormats = ['mp3', 'wav', 'ogg', 'm4a'];
      resourceType = 'video'; // Cloudinary treats audio as video resource
    } else if (!options.folder && mediaType === 'font') {
      folder = 'solo-ai/fonts';
      allowedFormats = ['ttf', 'otf', 'woff', 'woff2'];
      resourceType = 'raw'; // Fonts are raw files
      transformation = []; // No transformations for fonts
    } else if (!options.folder) {
      // Fallback to mimetype detection only if no custom folder provided
      if (file.mimetype.startsWith('image/')) {
        if (file.mimetype === 'image/gif') {
          folder = 'solo-ai/gifs';
        } else {
          folder = 'solo-ai/images';
        }
        allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        resourceType = 'image';
      } else if (file.mimetype.startsWith('audio/')) {
        folder = 'solo-ai/audio';
        allowedFormats = ['mp3', 'wav', 'ogg', 'm4a'];
        resourceType = 'video';
      } else if (file.mimetype.startsWith('video/')) {
        folder = 'solo-ai/gifs';
        resourceType = 'video';
        transformation = [
          { width: 800, crop: 'scale' },
          { quality: 'auto' },
          { format: 'gif' },
          { flags: 'animated' },
          { fps: 15 }
        ];
        allowedFormats = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
      } else if (file.mimetype.startsWith('font/') || 
                 file.mimetype === 'application/x-font-ttf' ||
                 file.mimetype === 'application/x-font-otf' ||
                 file.mimetype === 'application/font-woff' ||
                 file.mimetype === 'application/font-woff2') {
        folder = 'solo-ai/fonts';
        resourceType = 'raw';
        transformation = [];
      } else {
        throw new Error(`Unsupported file type: ${file.mimetype}`);
      }
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let publicId = `${options.prefix || 'media'}-${uniqueSuffix}`;

    // For raw resources (fonts), append file extension to publicId
    // This ensures the URL includes the extension for proper browser handling
    if (resourceType === 'raw' && file.originalname) {
      const extension = file.originalname.split('.').pop();
      if (extension) {
        publicId = `${publicId}.${extension}`;
      }
    }

    // Log upload attempt
    logger.info('Uploading file to Cloudinary...', { 
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      type: mediaType,
      folder: folder,
      resourceType: resourceType,
      publicId: publicId,
      isFont: mediaType === 'font',
      isVideoToGif: file.mimetype.startsWith('video/') && mediaType === 'gif'
    });

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      // Build upload options
      const uploadOptions = {
        folder: folder,
        resource_type: resourceType,
        public_id: publicId,
        type: 'upload', // Public access for all uploaded files
        transformation: transformation
      };

      // Only add allowed_formats for non-raw resources (images, videos)
      // Raw resources (fonts) don't support format validation
      if (resourceType !== 'raw' && allowedFormats.length > 0) {
        uploadOptions.allowed_formats = allowedFormats;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            logger.info('File uploaded to Cloudinary:', { 
              publicId: result.public_id,
              url: result.secure_url,
              format: result.format
            });
            resolve(result);
          }
        }
      );

      uploadStream.end(file.buffer);
    });

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      folder: folder,
      resourceType: resourceType,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      duration: result.duration
    };
  } catch (error) {
    logger.error('Upload to Cloudinary failed:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of the file to delete
 * @param {string} resourceType - Resource type (image, video, raw)
 * @returns {Promise<Object>} Deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    if (!publicId) {
      throw new Error('Public ID is required for deletion');
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });

    logger.info('Deleted from Cloudinary:', { publicId, result });

    return {
      success: result.result === 'ok',
      message: result.result === 'ok' ? 'File deleted successfully' : 'File not found or already deleted',
      result: result
    };
  } catch (error) {
    logger.error('Failed to delete from Cloudinary:', { publicId, error: error.message });
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Bulk delete files from Cloudinary
 * @param {Array<string>} publicIds - Array of public IDs to delete
 * @param {string} resourceType - Resource type (image, video, raw)
 * @returns {Promise<Object>} Bulk deletion result
 */
const bulkDeleteFromCloudinary = async (publicIds, resourceType = 'image') => {
  try {
    if (!publicIds || publicIds.length === 0) {
      throw new Error('No public IDs provided for bulk deletion');
    }

    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType
    });

    const deletedCount = Object.keys(result.deleted || {}).length;
    const failedCount = publicIds.length - deletedCount;

    logger.info('Bulk deleted from Cloudinary:', { 
      total: publicIds.length,
      deleted: deletedCount,
      failed: failedCount 
    });

    return {
      success: true,
      deletedCount,
      failedCount,
      result: result
    };
  } catch (error) {
    logger.error('Failed to bulk delete from Cloudinary:', { 
      count: publicIds.length, 
      error: error.message 
    });
    throw new Error(`Failed to bulk delete files: ${error.message}`);
  }
};

/**
 * Validate file type
 * @param {string} mimetype - File mimetype
 * @returns {boolean} Whether file type is valid
 */
const isValidFileType = (mimetype) => {
  const allowedMimeTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/m4a',
    'audio/x-m4a',
    // Video (for GIF conversion)
    'video/mp4',
    'video/quicktime', // .mov
    'video/x-msvideo', // .avi
    'video/webm',
    'video/x-matroska', // .mkv
    // Fonts
    'font/ttf',
    'font/otf',
    'font/woff',
    'font/woff2',
    'application/x-font-ttf',
    'application/x-font-otf',
    'application/font-woff',
    'application/font-woff2',
    'application/x-font-truetype',
    'application/x-font-opentype',
    'application/octet-stream' // Some fonts come as this
  ];

  return allowedMimeTypes.includes(mimetype);
};

/**
 * Get resource type from mimetype
 * @param {string} mimetype - File mimetype
 * @returns {string} Cloudinary resource type
 */
const getResourceType = (mimetype) => {
  if (mimetype.startsWith('image/')) {
    return 'image';
  } else if (mimetype.startsWith('audio/')) {
    return 'video'; // Cloudinary treats audio as video
  } else if (mimetype.startsWith('video/')) {
    return 'video';
  } else if (mimetype.startsWith('font/') || 
             mimetype.includes('font') || 
             mimetype === 'application/octet-stream') {
    return 'raw'; // Fonts are raw resources
  }
  return 'auto';
};

/**
 * Check if file is a font based on mimetype or extension
 * @param {string} mimetype - File mimetype
 * @param {string} filename - File name with extension
 * @returns {boolean} Whether file is a font
 */
const isFontFile = (mimetype, filename = '') => {
  const fontMimeTypes = [
    'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
    'application/x-font-ttf', 'application/x-font-otf',
    'application/font-woff', 'application/font-woff2',
    'application/x-font-truetype', 'application/x-font-opentype',
    'application/octet-stream'
  ];
  
  const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
  const hasExtension = fontExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  
  return fontMimeTypes.includes(mimetype) || hasExtension;
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  bulkDeleteFromCloudinary,
  isValidFileType,
  getResourceType,
  isFontFile,
  reconfigureCloudinary,
  initializeCloudinary
};
