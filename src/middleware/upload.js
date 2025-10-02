const multer = require('multer');
const path = require('path');
const { generateUniqueFilename } = require('../utils/helpers');
const AppError = require('../utils/appError');

// Storage configuration for videos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/videos'));
  },
  filename: (req, file, cb) => {
    const uniqueFilename = generateUniqueFilename(file.originalname);
    cb(null, uniqueFilename);
  }
});

// Storage configuration for thumbnails/images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/thumbnails'));
  },
  filename: (req, file, cb) => {
    const uniqueFilename = generateUniqueFilename(file.originalname);
    cb(null, uniqueFilename);
  }
});

// File filter for videos
const videoFileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/quicktime'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only video files are allowed.', 400), false);
  }
};

// File filter for images
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only image files are allowed.', 400), false);
  }
};

// Video upload configuration
const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// Image upload configuration
const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Memory storage for temporary processing
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// Handle multer errors
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File too large. Maximum size is 100MB for videos and 10MB for images.', 400));
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError('Too many files. Maximum 1 file allowed.', 400));
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Unexpected file field.', 400));
    }
  }
  next(error);
};

module.exports = {
  uploadVideo,
  uploadImage,
  uploadMemory,
  handleMulterError
};