const Joi = require('joi');

// User validation schemas
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot be longer than 50 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  loginType: Joi.string().valid('email', 'google', 'apple').default('email').messages({
    'any.only': 'Login type must be email, google, or apple'
  }),
  password: Joi.when('loginType', {
    is: 'email',
    then: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
      'any.required': 'Password is required for email registration'
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown': 'Password should not be provided for social login'
    })
  }),
  confirmPassword: Joi.when('loginType', {
    is: 'email',
    then: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required'
    }),
    otherwise: Joi.forbidden()
  }),
  // Optional profile fields during registration
  dateOfBirth: Joi.date().max('now').optional().messages({
    'date.max': 'Date of birth must be in the past'
  }),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say').optional(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]{10,15}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  loginType: Joi.string().valid('email', 'google', 'apple').default('email'),
  password: Joi.when('loginType', {
    is: 'email',
    then: Joi.string().required().messages({
      'any.required': 'Password is required for email login'
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown': 'Password should not be provided for social login'
    })
  })
});

// User profile update schema
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  dateOfBirth: Joi.date().max('now').optional().messages({
    'date.max': 'Date of birth must be in the past'
  }),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say').optional(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]{10,15}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  }),
  preferences: Joi.object({
    defaultPlatforms: Joi.array().items(
      Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin')
    ).optional(),
    autoGenerateCaption: Joi.boolean().optional()
  }).optional()
});

// Video validation schemas
const videoUploadSchema = Joi.object({
  title: Joi.string().min(1).max(100).required().messages({
    'string.min': 'Title cannot be empty',
    'string.max': 'Title cannot be longer than 100 characters',
    'any.required': 'Title is required'
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot be longer than 500 characters'
  })
});

const videoEditSchema = Joi.object({
  title: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  edits: Joi.object({
    trimStart: Joi.number().min(0).optional(),
    trimEnd: Joi.number().min(0).optional(),
    speed: Joi.number().min(0.25).max(4).optional(),
    filters: Joi.array().items(Joi.string()).optional(),
    overlays: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('text', 'sticker', 'drawing').required(),
        data: Joi.any().required(),
        position: Joi.object({
          x: Joi.number().required(),
          y: Joi.number().required()
        }).required(),
        timestamp: Joi.number().min(0).required()
      })
    ).optional()
  }).optional()
});

// Post validation schemas
const postCreateSchema = Joi.object({
  videoId: Joi.string().required().messages({
    'any.required': 'Video ID is required'
  }),
  caption: Joi.string().min(1).max(2200).required().messages({
    'string.min': 'Caption cannot be empty',
    'string.max': 'Caption cannot be longer than 2200 characters',
    'any.required': 'Caption is required'
  }),
  hashtags: Joi.array().items(Joi.string().max(30)).max(30).optional(),
  platforms: Joi.array().items(
    Joi.object({
      name: Joi.string().valid('instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin').required(),
      accountId: Joi.string().required()
    })
  ).min(1).required().messages({
    'array.min': 'At least one platform must be selected',
    'any.required': 'Platforms are required'
  }),
  scheduledFor: Joi.date().min('now').optional(),
  settings: Joi.object({
    autoPublish: Joi.boolean().optional(),
    allowComments: Joi.boolean().optional(),
    allowLikes: Joi.boolean().optional(),
    visibility: Joi.string().valid('public', 'private', 'unlisted').optional()
  }).optional()
});

// Social account validation schemas - updated for portal-link approach
const socialAccountConnectSchema = Joi.object({
  socialAccountTypes: Joi.array().items(
    Joi.string().valid('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'TWITTER', 'LINKEDIN')
  ).optional(),
  redirectUrl: Joi.string().uri().optional()
});

// Pagination validation
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// AI caption validation
const aiCaptionSchema = Joi.object({
  videoId: Joi.string().required(),
  prompt: Joi.string().max(500).optional(),
  tone: Joi.string().valid('professional', 'casual', 'funny', 'inspirational', 'educational').optional(),
  includeHashtags: Joi.boolean().default(true),
  maxLength: Joi.number().integer().min(50).max(2200).default(300)
});

// Refresh token validation
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required'
  })
});

// Delete account validation
const deleteAccountSchema = Joi.object({
  password: Joi.string().optional().messages({
    'string.base': 'Password must be a string'
  })
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  videoUploadSchema,
  videoEditSchema,
  postCreateSchema,
  socialAccountConnectSchema,
  paginationSchema,
  aiCaptionSchema,
  refreshTokenSchema,
  deleteAccountSchema
};