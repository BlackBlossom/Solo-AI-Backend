const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { uploadsDir } = require('../middleware/imageUpload');

const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

/**
 * Upload an image
 */
exports.uploadImage = catchAsync(async (req, res, next) => {
  // Check if file was uploaded
  if (!req.file) {
    return next(new AppError('Please provide an image file', 400));
  }

  // Get the base URL from environment or request
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  // Construct the public URL
  const publicUrl = `${baseUrl}/api/v1/images/serve/${req.file.filename}`;

  res.status(201).json({
    status: 'success',
    data: {
      url: publicUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    }
  });
});

/**
 * Serve an image publicly
 */
exports.serveImage = catchAsync(async (req, res, next) => {
  const { filename } = req.params;

  // Sanitize filename to prevent directory traversal
  const sanitizedFilename = path.basename(filename);
  const filePath = path.join(uploadsDir, sanitizedFilename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return next(new AppError('Image not found', 404));
  }

  // Get file stats
  const stats = await statAsync(filePath);
  
  // Check if it's a file (not a directory)
  if (!stats.isFile()) {
    return next(new AppError('Invalid file', 400));
  }

  // Set appropriate headers
  const ext = path.extname(sanitizedFilename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };

  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  
  // Set CORS headers explicitly for image serving
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

  // Stream the file
  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
});

/**
 * Delete an image
 */
exports.deleteImage = catchAsync(async (req, res, next) => {
  const { filename } = req.params;

  // Sanitize filename to prevent directory traversal
  const sanitizedFilename = path.basename(filename);
  const filePath = path.join(uploadsDir, sanitizedFilename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return next(new AppError('Image not found', 404));
  }

  // Delete the file
  await unlinkAsync(filePath);

  res.status(200).json({
    status: 'success',
    message: 'Image deleted successfully'
  });
});

/**
 * List all uploaded images (admin only)
 */
exports.listImages = catchAsync(async (req, res, next) => {
  // Read all files in the uploads directory
  const files = await readdirAsync(uploadsDir);

  // Filter only image files and get their stats
  const imageFiles = [];
  
  for (const filename of files) {
    const filePath = path.join(uploadsDir, filename);
    const stats = await statAsync(filePath);
    
    if (stats.isFile()) {
      const ext = path.extname(filename).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      if (validExtensions.includes(ext)) {
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        imageFiles.push({
          filename: filename,
          url: `${baseUrl}/api/v1/images/serve/${filename}`,
          size: stats.size,
          uploadedAt: stats.birthtime
        });
      }
    }
  }

  // Sort by upload date (newest first)
  imageFiles.sort((a, b) => b.uploadedAt - a.uploadedAt);

  res.status(200).json({
    status: 'success',
    results: imageFiles.length,
    data: imageFiles
  });
});
