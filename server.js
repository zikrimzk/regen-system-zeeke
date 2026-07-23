require('dotenv').config();

const hasSecureSessionSecret = Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32);
if (process.env.NODE_ENV === 'production' && !hasSecureSessionSecret) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
}
if (!hasSecureSessionSecret) {
  console.warn('[Security] SESSION_SECRET should be set to a random 32+ character value before production use.');
}

const express = require('express');
const path    = require('path');

// Init DB (connects on load)
const db = require('./app/config/db');

const sessionConfig = require('./app/config/session');
const routes        = require('./app/routes/index');
const pdfService    = require('./app/services/pdfService');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// ── Middleware ─────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use(sessionConfig);

// ── Static files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders: (res) => {
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

// ── Routes ─────────────────────────────────────────────────────
app.use('/', routes);

// ── 404 ─────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));

// ── Error handler ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  if (err?.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Photo must be smaller than 5MB.'
      : 'Photo upload could not be processed.';
    return res.status(status).json({ success: false, message });
  }
  if (err?.message === 'Only JPG and PNG images are allowed.') {
    return res.status(400).json({ success: false, message: err.message });
  }
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err.message || 'Internal server error');
  res.status(500).json({ success: false, message });
});

// ── Start ─────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\nReGen powered by Zeeke -> http://localhost:${PORT}\n`);
});

module.exports = app;
module.exports.server = server;

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Server] ${signal} received; finishing active requests.`);
  server.close(async () => {
    try {
      await pdfService.close();
      await db.end();
    } finally {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
