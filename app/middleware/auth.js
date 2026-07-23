/**
 * auth.js — Route-level middleware.
 * Protects HTML pages and API routes that require login.
 */

/**
 * For API routes — returns 401 JSON if not logged in.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  next();
}

/**
 * For HTML page routes — redirects to /login if not logged in.
 */
function requireAuthPage(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

/**
 * For auth pages — redirects to /dashboard if already logged in.
 */
function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { requireAuth, requireAuthPage, redirectIfLoggedIn };
