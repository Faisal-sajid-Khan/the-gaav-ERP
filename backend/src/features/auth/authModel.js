'use strict';
const { query } = require('../../config/db');

const findByEmail = async (email) => {
  const rows = await query('SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1', [email]);
  return rows[0] || null;
};

const updateLastLogin = async (id) => {
  await query('UPDATE users SET last_login = NOW() WHERE id = ?', [id]);
};

const updateRefreshToken = async (id, tokenHash) => {
  await query('UPDATE users SET refresh_token_hash = ? WHERE id = ?', [tokenHash, id]);
};

const findById = async (id) => {
  const rows = await query('SELECT id, name, email, role, is_active, last_login, created_at FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
};

const clearRefreshToken = async (id) => {
  await query('UPDATE users SET refresh_token_hash = NULL WHERE id = ?', [id]);
};

module.exports = { findByEmail, updateLastLogin, updateRefreshToken, findById, clearRefreshToken };
