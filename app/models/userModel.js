const db = require('../config/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Create a new user.
 * @param {object} data — { firstName, lastName, email, password, phone, address }
 * @returns {object} Created user row (without password_hash)
 */
async function createUser({ firstName, lastName, email, password, phone = '', address = '' }) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const [result] = await db.execute(
    `INSERT INTO users (first_name, last_name, email, password_hash, phone, address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [firstName.trim(), lastName.trim(), email.trim().toLowerCase(), hash, phone.trim(), address.trim()]
  );
  return { id: result.insertId, firstName, lastName, email, phone, address };
}

/**
 * Find user by email.
 * @returns {object|null} User row or null
 */
async function findByEmail(email) {
  const [rows] = await db.execute(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email.trim().toLowerCase()]
  );
  return rows[0] || null;
}

/**
 * Find user by ID.
 * @returns {object|null} User row (no password_hash) or null
 */
async function findById(id) {
  const [rows] = await db.execute(
    'SELECT id, first_name, last_name, email, phone, address, created_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Verify password against stored hash.
 * @returns {boolean}
 */
async function verifyPassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

/**
 * Check if email is already registered.
 * @returns {boolean}
 */
async function emailExists(email) {
  const [rows] = await db.execute(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email.trim().toLowerCase()]
  );
  return rows.length > 0;
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  verifyPassword,
  emailExists,
};
