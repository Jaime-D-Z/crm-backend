/**
 * Centralized Configuration Manager
 * Loads and validates environment variables
 * Provides different configs for development and production
 */

require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'DB_HOST',
  'DB_USER',
  'DB_PASS',
  'DB_NAME'
];

if (isProduction) {
  requiredEnvVars.push('FRONTEND_URL', 'BACKEND_URL');
  
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

const config = {
  // Environment
  env: NODE_ENV,
  isDevelopment,
  isProduction,
  
  // Server
  port: parseInt(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || 'CRM System',
  backendUrl: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Security
  trustProxy: isProduction, // Enable when behind reverse proxy (Nginx)
  forceHttps: isProduction && process.env.FORCE_HTTPS !== 'false',
  
  // Database
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    max: parseInt(process.env.DB_POOL_MAX) || (isProduction ? 20 : 10),
    min: parseInt(process.env.DB_POOL_MIN) || (isProduction ? 5 : 2),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
    ssl: isProduction && process.env.DB_SSL !== 'false' ? {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
    } : false
  },
  
  // JWT
  jwt: {
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '8h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },
  
  // Session
  session: {
    secret: process.env.SESSION_SECRET,
    name: 'crm.sid',
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 8 * 60 * 60 * 1000,
    secure: isProduction, 
    // "none" es obligatorio para que la cookie funcione entre Vercel y DuckDNS
    sameSite: isProduction ? 'none' : 'lax'
  },
  
  // CORS Configuration
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const isVercel = origin.includes('.vercel.app');
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.FRONTEND_URL_DEV,
        'https://crm-frontend-jaime-d-zs-projects.vercel.app'
      ].filter(Boolean);

      if (allowedOrigins.includes(origin) || (isProduction && isVercel)) {
        return callback(null, true);
      }

      console.error(`❌ CORS blocked origin: "${origin}"`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['set-cookie']
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || (isProduction ? 100 : 1000),
    loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS) || 5
  },
  
  // Email
  email: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM || `${process.env.APP_NAME} <noreply@example.com>`
  },
  
  // File Upload
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 2 * 1024 * 1024,
    allowedTypes: ['.jpg', '.jpeg', '.png', '.webp']
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    enableConsole: process.env.LOG_CONSOLE !== 'false'
  }
};

module.exports = config;