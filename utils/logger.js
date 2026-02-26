/**
 * Centralized Logger
 * Different behavior for development vs production
 */

const config = require('../config');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class Logger {
  constructor() {
    this.isDevelopment = config.isDevelopment;
    this.level = config.logging.level;
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    
    if (this.isDevelopment) {
      // Colorful console output for development
      const color = {
        error: colors.red,
        warn: colors.yellow,
        info: colors.blue,
        debug: colors.cyan
      }[level] || colors.reset;
      
      return `${color}[${timestamp}] ${level.toUpperCase()}:${colors.reset} ${message}`;
    } else {
      // JSON format for production (easier to parse by log aggregators)
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
      });
    }
  }

  error(message, error = null) {
    const meta = error ? {
      error: error.message,
      stack: error.stack
    } : {};
    
    console.error(this._formatMessage('error', message, meta));
    
    if (this.isDevelopment && error) {
      console.error(error);
    }
  }

  warn(message, meta = {}) {
    console.warn(this._formatMessage('warn', message, meta));
  }

  info(message, meta = {}) {
    console.log(this._formatMessage('info', message, meta));
  }

  debug(message, meta = {}) {
    if (this.level === 'debug' || this.isDevelopment) {
      console.log(this._formatMessage('debug', message, meta));
    }
  }

  http(req, res, duration) {
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 500) {
      this.error(message);
    } else if (res.statusCode >= 400) {
      this.warn(message);
    } else {
      this.info(message);
    }
  }
}

module.exports = new Logger();
