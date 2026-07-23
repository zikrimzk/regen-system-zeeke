const express  = require('express');
const path     = require('path');
const router   = express.Router();
const { requireAuthPage, redirectIfLoggedIn } = require('../middleware/auth');

const authRoutes      = require('./authRoutes');
const resumeRoutes    = require('./resumeRoutes');
const pdfRoutes       = require('./pdfRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const lookupRoutes    = require('./lookupRoutes');
const db              = require('../config/db');

// ── API ────────────────────────────────────────────────────────
router.use('/api/auth',      authRoutes);
router.use('/api/resume',    resumeRoutes);
router.use('/api/pdf',       pdfRoutes);
router.use('/api/dashboard', dashboardRoutes);
router.use('/api/lookups',   lookupRoutes);

// ── Health ─────────────────────────────────────────────────────
router.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ success: true, message: 'ReGen API ready' });
  } catch (err) {
    res.status(503).json({ success: false, message: 'Service unavailable' });
  }
});

// ── HTML Pages ─────────────────────────────────────────────────
const PUBLIC = path.join(__dirname, '../../public');

router.get('/',          (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.redirect('/login');
});
router.get('/login',     redirectIfLoggedIn, (req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));
router.get('/register',  redirectIfLoggedIn, (req, res) => res.sendFile(path.join(PUBLIC, 'register.html')));
router.get('/dashboard', requireAuthPage,    (req, res) => res.sendFile(path.join(PUBLIC, 'dashboard.html')));
router.get('/builder',   requireAuthPage,    (req, res) => res.sendFile(path.join(PUBLIC, 'builder.html')));

module.exports = router;
