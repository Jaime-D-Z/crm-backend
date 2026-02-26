const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

// Create PostgreSQL connection pool with production-ready settings
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  max: config.database.max,
  min: config.database.min,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.connectionTimeoutMillis,
  ssl: config.database.ssl,
  // Handle connection errors
  connectionTimeoutMillis: 5000,
  query_timeout: 30000, // 30 seconds max query time
  statement_timeout: 30000
});

// Pool error handler
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

// Pool connection event
pool.on('connect', (client) => {
  logger.debug('New PostgreSQL client connected');
});

// Pool removal event
pool.on('remove', (client) => {
  logger.debug('PostgreSQL client removed from pool');
});
/**
 * Execute a parameterized SQL query.
 * Adapts internal ? placeholders to PostgreSQL $1, $2, etc. if needed,
 * but recommended to update models to use $ placeholders directly.
 * For now, this helper will keep the same interface.
 * @param {string} sql
 * @param {Array}  params
 * @returns {Promise<any[]>}
 */
async function query(sql, params = []) {
  // Simple regex to replace ? with $1, $2... if they exist
  let index = 1;
  const pgSql = sql.replace(/\?/g, () => `$${index++}`);

  const safeParams = Array.isArray(params) ? params : [params].filter(p => p !== undefined);

  try {
    const result = await pool.query(pgSql, safeParams);
    return result.rows;
  } catch (err) {
    logger.error('Database query error', {
      message: err.message,
      sql: pgSql,
      params: safeParams,
      code: err.code
    });
    throw err;
  }
}

async function verifyConnection() {
  try {
    const res = await pool.query('SELECT NOW() as now, version() as version');
    logger.info('✔ PostgreSQL connected successfully', {
      timestamp: res.rows[0].now,
      version: res.rows[0].version.split(' ')[0]
    });
    return true;
  } catch (err) {
    logger.error('✘ PostgreSQL connection failed', err);
    logger.error('Check your database configuration in .env file');
    
    if (config.isProduction) {
      // In production, exit if DB connection fails
      process.exit(1);
    }
    return false;
  }
}

// Graceful shutdown
async function closePool() {
  try {
    await pool.end();
    logger.info('PostgreSQL pool closed');
  } catch (err) {
    logger.error('Error closing PostgreSQL pool', err);
  }
}

module.exports = { pool, query, verifyConnection, closePool };
