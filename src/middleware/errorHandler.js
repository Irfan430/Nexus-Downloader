const logger = require('../utils/logger');

function notFound(req, res) {
  res.status(404).json({ success: false, error: 'Not found' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.statusCode || error.status || 500;
  logger.error('request_failed', {
    status,
    method: req.method,
    path: req.path,
    error: error.message,
    stack: error.stack,
    details: error.details
  });
  return res.status(status).json({
    success: false,
    code: error.code || 'REQUEST_FAILED',
    error: error.publicMessage || (status >= 500 ? 'Internal server error' : error.message),
    details: status >= 500 ? undefined : error.details
  });
}

module.exports = { errorHandler, notFound };
