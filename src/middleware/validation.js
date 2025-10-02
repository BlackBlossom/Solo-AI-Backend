const { sendValidationError } = require('../utils/response');

// Middleware to validate request data using Joi schemas
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all validation errors
      allowUnknown: false, // Don't allow unknown fields
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return sendValidationError(res, validationErrors);
    }

    // Replace the request data with the validated and sanitized data
    req[property] = value;
    next();
  };
};

// Validate query parameters
const validateQuery = (schema) => validate(schema, 'query');

// Validate request parameters
const validateParams = (schema) => validate(schema, 'params');

// Custom validation middleware for file uploads
const validateFileUpload = (options = {}) => {
  return (req, res, next) => {
    const {
      required = true,
      allowedTypes = [],
      maxSize = 100 * 1024 * 1024, // 100MB default
      fieldName = 'file'
    } = options;

    const file = req.file || req.files?.[fieldName];

    // Check if file is required
    if (required && !file) {
      return sendValidationError(res, [{
        field: fieldName,
        message: 'File is required',
        value: null
      }]);
    }

    // If file is not required and not provided, continue
    if (!required && !file) {
      return next();
    }

    // Validate file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      return sendValidationError(res, [{
        field: fieldName,
        message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        value: file.mimetype
      }]);
    }

    // Validate file size
    if (file.size > maxSize) {
      return sendValidationError(res, [{
        field: fieldName,
        message: `File size too large. Maximum size: ${Math.round(maxSize / (1024 * 1024))}MB`,
        value: `${Math.round(file.size / (1024 * 1024))}MB`
      }]);
    }

    next();
  };
};

// Validate video file uploads
const validateVideoUpload = validateFileUpload({
  required: true,
  allowedTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/quicktime'],
  maxSize: 100 * 1024 * 1024, // 100MB
  fieldName: 'video'
});

// Validate image file uploads
const validateImageUpload = validateFileUpload({
  required: false,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxSize: 10 * 1024 * 1024, // 10MB
  fieldName: 'image'
});

module.exports = {
  validate,
  validateQuery,
  validateParams,
  validateFileUpload,
  validateVideoUpload,
  validateImageUpload
};