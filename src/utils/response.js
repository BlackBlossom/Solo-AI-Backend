// Standardized API response formatter
const sendResponse = (res, statusCode, status, message, data = null, meta = null) => {
  const response = {
    status,
    message,
    ...(data && { data }),
    ...(meta && { meta })
  };
  
  return res.status(statusCode).json(response);
};

// Success responses
const sendSuccess = (res, message = 'Success', data = null, meta = null) => {
  return sendResponse(res, 200, 'success', message, data, meta);
};

const sendCreated = (res, message = 'Created successfully', data = null) => {
  return sendResponse(res, 201, 'success', message, data);
};

// Error responses
const sendError = (res, statusCode = 500, message = 'Internal server error', errors = null) => {
  const response = {
    status: 'error',
    message,
    ...(errors && { errors })
  };
  
  return res.status(statusCode).json(response);
};

const sendBadRequest = (res, message = 'Bad request', errors = null) => {
  return sendError(res, 400, message, errors);
};

const sendUnauthorized = (res, message = 'Unauthorized') => {
  return sendError(res, 401, message);
};

const sendForbidden = (res, message = 'Forbidden') => {
  return sendError(res, 403, message);
};

const sendNotFound = (res, message = 'Not found') => {
  return sendError(res, 404, message);
};

const sendConflict = (res, message = 'Conflict') => {
  return sendError(res, 409, message);
};

const sendValidationError = (res, errors, message = 'Validation failed') => {
  return sendError(res, 422, message, errors);
};

// Pagination helper
const getPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

module.exports = {
  sendResponse,
  sendSuccess,
  sendCreated,
  sendError,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError,
  getPaginationMeta
};