'use strict';
const { query } = require('../../config/db');

const getAll = async ({
  action,
  entity_type,
  user_id,
  start_date,
  end_date,
  page = 1,
  limit = 25
} = {}) => {
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];

  if (action) {
    where += ' AND al.action = ?';
    params.push(action);
  }
  if (entity_type) {
    where += ' AND al.entity_type = ?';
    params.push(entity_type);
  }
  if (user_id) {
    where += ' AND al.user_id = ?';
    params.push(user_id);
  }
  if (start_date) {
    where += ' AND al.created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND al.created_at <= ?';
    params.push(end_date);
  }

  const [countRes] = await query(`SELECT COUNT(*) as total FROM audit_logs al WHERE ${where}`, params);
  const total = countRes ? countRes.total : 0;

  const logs = await query(
    `SELECT 
      al.*,
      u.name as user_name,
      u.email as user_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE ${where}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  return { logs, total };
};

module.exports = { getAll };
