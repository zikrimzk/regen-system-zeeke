const userModel = require('../models/userModel');
const { cleanText: sanitizeText } = require('../utils/sanitizeResume');

/** Helpers */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(value, max = 200) {
  return sanitizeText(value).slice(0, max);
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (!err) return resolve();
      err.code = err.code || 'SESSION_REGENERATE_FAILED';
      reject(err);
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (!err) return resolve();
      err.code = err.code || 'SESSION_SAVE_FAILED';
      reject(err);
    });
  });
}

async function establishSession(req, user) {
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.userEmail = user.email;
  req.session.userName = `${user.first_name || user.firstName} ${user.last_name || user.lastName}`.trim();
  await saveSession(req);
}

/**
 * GET /login serves the login page through routes/index.js.
 * POST /api/auth/login
 */
async function login(req, res) {
  const email = cleanText(req.body.email, 200).toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  try {
    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const valid = await userModel.verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    await establishSession(req, user);
    res.json({
      success: true,
      authenticated: true,
      user: {
        id:        user.id,
        firstName: user.first_name,
        lastName:  user.last_name,
        email:     user.email,
      },
    });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    if (String(err.code || '').startsWith('SESSION_')) {
      return res.status(503).json({ success: false, message: 'Unable to start your session. Please try again.' });
    }
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
}

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  const firstName = cleanText(req.body.firstName, 100);
  const lastName = cleanText(req.body.lastName, 100);
  const email = cleanText(req.body.email, 200).toLowerCase();
  const phone = cleanText(req.body.phone, 30);
  const address = cleanText(req.body.address, 500);
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  // Validate
  const errors = [];
  if (!firstName || firstName.trim().length < 2)  errors.push('First name must be at least 2 characters.');
  if (!lastName  || lastName.trim().length < 2)   errors.push('Last name must be at least 2 characters.');
  if (!email     || !isValidEmail(email))          errors.push('Please enter a valid email address.');
  if (!password  || password.length < 8)           errors.push('Password must be at least 8 characters.');
  if (password   !== confirmPassword)              errors.push('Passwords do not match.');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  let user;
  try {
    const exists = await userModel.emailExists(email);
    if (exists) {
      return res.status(409).json({ success: false, message: 'This email is already registered. Please log in.' });
    }

    user = await userModel.createUser({ firstName, lastName, email, password, phone, address });
    await establishSession(req, user);
    res.status(201).json({ success: true, authenticated: true, user });
  } catch (err) {
    console.error('[Auth Register Error]', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'This email is already registered. Please log in.' });
    }
    if (user && String(err.code || '').startsWith('SESSION_')) {
      return res.status(201).json({
        success: true,
        authenticated: false,
        user,
        message: 'Account created. Please log in to continue.',
      });
    }
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
}

/**
 * GET /api/auth/logout
 */
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) console.error('[Logout Error]', err);
    res.clearCookie('regen.sid');
    res.clearCookie('zeeke.sid');
    res.json({ success: true });
  });
}

/**
 * GET /api/auth/me — returns current user info
 */
async function me(req, res) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  try {
    const user = await userModel.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ success: false, message: 'Session expired.' });
    }
    res.json({ success: true, user, userName: req.session.userName });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
}

module.exports = { login, register, logout, me };
