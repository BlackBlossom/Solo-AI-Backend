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

// Video upload configuration for direct Bundle.social upload (no local storage)
const uploadVideoMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// File filter for admin media (images, audio, gifs, fonts)
const mediaFileFilter = (req, file, cb) => {
  const allowedTypes = [
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
    // Video (will be converted to GIF)
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
  
  // Check if it's a font file by extension
  const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
  const isFontByExtension = fontExtensions.some(ext => 
    file.originalname.toLowerCase().endsWith(ext)
  );
  
  if (allowedTypes.includes(file.mimetype) || isFontByExtension) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type: ${file.mimetype}. Only images (JPEG, PNG, GIF, WebP, SVG), audio files (MP3, WAV, OGG, M4A), videos (MP4, MOV, AVI, WebM, MKV), and fonts (TTF, OTF, WOFF, WOFF2) are allowed.`, 400), false);
  }
};

// Media upload configuration for Cloudinary (memory storage)
const uploadMedia = multer({
  storage: multer.memoryStorage(),
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (videos can be larger)
  }
});

// Handle multer errors
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File too large. Maximum size is 100MB for videos, 50MB for media uploads, and 10MB for images.', 400));
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
  uploadVideoMemory,
  uploadMedia,
  handleMulterError
};