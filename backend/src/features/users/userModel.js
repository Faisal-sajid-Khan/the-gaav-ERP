'use strict';
const { query } = require('../../config/db');
const bcrypt = require('bcryptjs');

const getAll = async () => {
  return query('SELECT id, name, email, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC');
};

const getById = async (id) => {
  const rows = await query('SELECT id, name, email, role, is_active, last_login, created_at FROM users WHERE id = ?', [id]);
  return rows[0] || null;
};

const create = async ({ name, email, password, role }) => {
  const hash = await bcrypt.hash(password, 12);
  const result = await query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, hash, role || 'viewer']
  );
  return result.insertId;
};

const update = async (id, { name, role, is_active }) => {
  await query('UPDATE users SET name = ?, role = ?, is_active = ? WHERE id = ?', [name, role, is_active, id]);
};

const changePassword = async (id, newPassword) => {
  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
};

const emailExists = async (email, excludeId = null) => {
  const sql = excludeId ? 'SELECT id FROM users WHERE email = ? AND id != ?' : 'SELECT id FROM users WHERE email = ?';
  const params = excludeId ? [email, excludeId] : [email];
  const rows = await query(sql, params);
  return rows.length > 0;
};

module.exports = { getAll, getById, create, update, changePassword, emailExists };
