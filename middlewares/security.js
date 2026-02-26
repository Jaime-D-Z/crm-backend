/**
 * Security Middleware
 * - Force HTTPS in production
 * - Security headers with Helmet
 * - Request logging
 */

const helmet = require('helmet');
const config = require('../config');
const logger = require('../utils/logger');

// Force HTTPS redirect in production
const forceHttps = (req, res, next) => {
  if (!config.forceHttps) {
    return next();
  }

  // Check if request is already HTTPS
  const isHttps = req.secure || 
                  req.headers['x-forwarded-proto'] === 'https' ||
                  req.headers['x-forwarded-ssl'] === 'on';

  if (!isHttps) {
    logger.warn(`HTTP request redirected to HTTPS: ${req.originalUrl}`);
    return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
  }

  next();
};

// Helmet configuration for production
const helmetConfig = helmet({
  contentSecurityPolicy: config.isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", config.frontendUrl],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  } : false, // Disable CSP in development for easier debugging
  
  hsts: config.isProduction ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Request logger middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(req, res, duration);
  });
  
  next();
};

// Security headers for API responses
const apiSecurityHeaders = (req, res, next) => {
  // Prevent caching of sensitive API responses
  if (req.path.startsWith('/api')) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  next();
};

module.exports = {
  forceHttps,
  helmetConfig,
  requestLogger,
  apiSecurityHeaders
};
