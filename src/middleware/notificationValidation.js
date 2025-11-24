const Joi = require('joi');
const { sendBadRequest } = require('../utils/response');

/**
 * Validate device token registration
 */
const validateDeviceToken = (req, res, next) => {
  const schema = Joi.object({
    token: Joi.string().required().min(50).max(500)
      .messages({
        'string.empty': 'Device token is required',
        'string.min': 'Invalid device token format',
        'string.max': 'Invalid device token format',
        'any.required': 'Device token is required'
      }),
    deviceId: Joi.string().optional().max(100),
    platform: Joi.string().required().valid('android', 'ios', 'web')
      .messages({
        'any.required': 'Platform is required',
        'any.only': 'Platform must be one of: android, ios, web'
      })
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return sendBadRequest(res, error.details[0].message);
  }

  next();
};

/**
 * Validate remove device token request
 */
const validateRemoveToken = (req, res, next) => {
  const schema = Joi.object({
    token: Joi.string().required().min(50).max(500)
      .messages({
        'string.empty': 'Device token is required',
        'any.required': 'Device token is required'
      })
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return sendBadRequest(res, error.details[0].message);
  }

  next();
};

/**
 * Validate send notification request
 */
const validateSendNotification = (req, res, next) => {
  const schema = Joi.object({
    title: Joi.string().required().min(1).max(100)
      .messages({
        'string.empty': 'Title is required',
        'string.max': 'Title cannot exceed 100 characters',
        'any.required': 'Title is required'
      }),
    body: Joi.string().required().min(1).max(500)
      .messages({
        'string.empty': 'Body is required',
        'string.max': 'Body cannot exceed 500 characters',
        'any.required': 'Body is required'
      }),
    type: Joi.string().optional().valid('announcement', 'promotion', 'content_update', 'account_alert', 'custom')
      .messages({
        'any.only': 'Type must be one of: announcement, promotion, content_update, account_alert, custom'
      }),
    targetType: Joi.string().required().valid('all', 'individual', 'segment')
      .messages({
        'any.required': 'Target type is required',
        'any.only': 'Target type must be one of: all, individual, segment'
      }),
    targetUserId: Joi.string().optional().when('targetType', {
      is: 'individual',
      then: Joi.required().messages({
        'any.required': 'Target user ID is required when targetType is "individual"'
      })
    }),
    targetSegment: Joi.object({
      loginType: Joi.string().optional().valid('email', 'google', 'apple'),
      status: Joi.string().optional().valid('active', 'banned', 'suspended'),
      createdAfter: Joi.date().optional(),
      createdBefore: Joi.date().optional()
    }).optional(),
    data: Joi.object().optional().max(10)
      .messages({
        'object.max': 'Data object cannot have more than 10 keys'
      }),
    deepLink: Joi.string().optional().max(500),
    imageUrl: Joi.string().optional().uri().max(1000)
      .messages({
        'string.uri': 'Image URL must be a valid URL'
      }),
    priority: Joi.string().optional().valid('high', 'normal', 'low')
      .messages({
        'any.only': 'Priority must be one of: high, normal, low'
      }),
    isTest: Joi.boolean().optional()
  });

  const { error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return sendBadRequest(res, errors.join(', '));
  }

  next();
};

/**
 * Validate test notification request
 */
const validateTestNotification = (req, res, next) => {
  const schema = Joi.object({
    token: Joi.string().required().min(50).max(500)
      .messages({
        'string.empty': 'Device token is required',
        'any.required': 'Device token is required for testing'
      })
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return sendBadRequest(res, error.details[0].message);
  }

  next();
};

/**
 * Validate get target user count request
 */
const validateTargetUserCount = (req, res, next) => {
  const schema = Joi.object({
    targetType: Joi.string().required().valid('all', 'individual', 'segment')
      .messages({
        'any.required': 'Target type is required',
        'any.only': 'Target type must be one of: all, individual, segment'
      }),
    targetUserId: Joi.string().optional().when('targetType', {
      is: 'individual',
      then: Joi.required().messages({
        'any.required': 'Target user ID is required when targetType is "individual"'
      })
    }),
    targetSegment: Joi.object({
      loginType: Joi.string().optional().valid('email', 'google', 'apple'),
      status: Joi.string().optional().valid('active', 'banned', 'suspended'),
      createdAfter: Joi.date().optional(),
      createdBefore: Joi.date().optional()
    }).optional()
  });

  const { error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return sendBadRequest(res, errors.join(', '));
  }

  next();
};

module.exports = {
  validateDeviceToken,
  validateRemoveToken,
  validateSendNotification,
  validateTestNotification,
  validateTargetUserCount
};
