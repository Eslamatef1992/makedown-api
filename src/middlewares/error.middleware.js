const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  const statusCode = err.isApiError ? err.statusCode : 500;
  const message = err.isApiError ? err.message : 'Internal server error';

  if (!err.isApiError) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || undefined,
    stack: env.nodeEnv === 'development' ? err.stack : undefined,
  });
}

module.exports = errorMiddleware;
