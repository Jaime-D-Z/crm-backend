/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent JSON responses
 */

const logger = require('../utils/logger');
const config = require('../config');

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error
  logger.error(`Error: ${error.message}`, err);

  // Mongoose/PostgreSQL duplicate key error
  if (err.code === '23505') {
    error.message = 'Registro duplicado. Este valor ya existe.';
    error.statusCode = 400;
  }

  // Mongoose/PostgreSQL validation error
  if (err.code === '23502') {
    error.message = 'Faltan campos requeridos.';
    error.statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Token inválido.';
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expirado.';
    error.statusCode = 401;
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error.message = 'Archivo demasiado grande. Máximo 2MB.';
    error.statusCode = 400;
  }

  // Send response
  const response = {
    success: false,
    error: error.message || 'Error interno del servidor'
  };

  // Include stack trace only in development
  if (config.isDevelopment) {
    response.stack = err.stack;
  }

  res.status(error.statusCode).json(response);
};

// Async handler wrapper to avoid try-catch in every controller
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: 'Ruta no encontrada'
    });
  }
  // For non-API routes, redirect to frontend (SPA)
  res.redirect('/');
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
  notFoundHandler
};
