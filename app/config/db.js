const mysql = require('mysql2/promise');

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * MySQL connection pool — shared across the entire app.
 * Credentials from .env.
 */
const pool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              positiveInt(process.env.DB_PORT, 3306),
  user:              process.env.DB_USER     || 'root',
  password:          process.env.DB_PASSWORD || '',
  database:          process.env.DB_NAME     || 'zeekeresumedb',
  waitForConnections: true,
  connectionLimit:   Math.max(2, positiveInt(process.env.DB_POOL_SIZE, 20)),
  queueLimit:        0,
  maxIdle:           Math.max(2, positiveInt(process.env.DB_POOL_IDLE, 10)),
  idleTimeout:       60000,
  enableKeepAlive:   true,
  keepAliveInitialDelay: 0,
  connectTimeout:    10000,
  charset:           'utf8mb4',
  timezone:          '+00:00',
});

// Test connection on startup
pool.getConnection()
  .then(conn => { conn.release(); console.log('[DB] MySQL connected'); })
  .catch(err  => console.error('[DB] Connection failed:', err.message));

module.exports = pool;
