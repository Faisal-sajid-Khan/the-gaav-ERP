'use strict';

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message || 'Internal server error';
  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || null
  });
};

module.exports = errorHandler;
