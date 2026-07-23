const session = require('express-session');
const db = require('./db');

function withTimeout(promise, message, timeoutMs = 8000) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * MySQL-backed sessions remain valid across multiple application processes.
 */
class MysqlSessionStore extends session.Store {
  constructor({ ttlMs = 24 * 60 * 60 * 1000 } = {}) {
    super();
    this.ttlMs = ttlMs;
    this.ready = db.execute(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        sid VARCHAR(128) PRIMARY KEY,
        session_data JSON NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_app_sessions_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    this.cleanupTimer = setInterval(() => {
      this.ready
        .then(() => db.execute('DELETE FROM app_sessions WHERE expires_at <= UTC_TIMESTAMP(3)'))
        .catch(err => console.error('[Session Cleanup Error]', err.message));
    }, 15 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  expiryFor(sessionData) {
    const cookieExpiry = sessionData?.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : 0;
    return new Date(cookieExpiry > Date.now() ? cookieExpiry : Date.now() + this.ttlMs);
  }

  async get(sid, callback) {
    try {
      await withTimeout(this.ready, 'Session storage initialization timed out.');
      const [rows] = await withTimeout(
        db.execute(
          'SELECT session_data FROM app_sessions WHERE sid = ? AND expires_at > UTC_TIMESTAMP(3) LIMIT 1',
          [sid]
        ),
        'Session lookup timed out.'
      );
      if (!rows[0]) return callback(null, null);
      const value = rows[0].session_data;
      callback(null, typeof value === 'string' ? JSON.parse(value) : value);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid, sessionData, callback = () => {}) {
    try {
      await withTimeout(this.ready, 'Session storage initialization timed out.');
      await withTimeout(
        db.execute(
          `INSERT INTO app_sessions (sid, session_data, expires_at)
           VALUES (?, CAST(? AS JSON), ?)
           ON DUPLICATE KEY UPDATE session_data = VALUES(session_data), expires_at = VALUES(expires_at)`,
          [sid, JSON.stringify(sessionData), this.expiryFor(sessionData)]
        ),
        'Session save timed out.'
      );
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  async destroy(sid, callback = () => {}) {
    try {
      await withTimeout(this.ready, 'Session storage initialization timed out.');
      await withTimeout(
        db.execute('DELETE FROM app_sessions WHERE sid = ?', [sid]),
        'Session reset timed out.'
      );
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  async touch(sid, sessionData, callback = () => {}) {
    try {
      await withTimeout(this.ready, 'Session storage initialization timed out.');
      await withTimeout(
        db.execute(
          'UPDATE app_sessions SET expires_at = ? WHERE sid = ?',
          [this.expiryFor(sessionData), sid]
        ),
        'Session refresh timed out.'
      );
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

const sessionConfig = session({
  name: 'regen.sid',
  secret: process.env.SESSION_SECRET || 'change-this-regen-session-secret',
  store: new MysqlSessionStore(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: 'auto',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
});

module.exports = sessionConfig;
