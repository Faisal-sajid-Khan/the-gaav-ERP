'use strict';
const { query } = require('../../config/db');

const getAll = async (userId, unreadOnly = false) => {
  let sql = 'SELECT * FROM notifications WHERE (user_id = ? OR user_id IS NULL)';
  const params = [userId];
  if (unreadOnly) {
    sql += ' AND is_read = 0';
  }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  return query(sql, params);
};

const getUnreadCount = async (userId) => {
  const [row] = await query(
    'SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0',
    [userId]
  );
  return row ? row.count : 0;
};

const markAsRead = async (id, userId) => {
  await query(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
    [id, userId]
  );
};

const markAllAsRead = async (userId) => {
  await query(
    'UPDATE notifications SET is_read = 1 WHERE (user_id = ? OR user_id IS NULL)',
    [userId]
  );
};

const create = async ({ userId = null, title, message, type = 'info', link = null }) => {
  const result = await query(
    'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
    [userId, title, message, type, link]
  );
  return result.insertId;
};

module.exports = {
  getAll,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  create
};
