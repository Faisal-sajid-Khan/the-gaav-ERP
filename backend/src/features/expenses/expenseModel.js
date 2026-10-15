'use strict';
const { query } = require('../../config/db');

const getAll = async ({
  page = 1,
  limit = 50,
  start_date,
  end_date,
  category,
  is_cogs,
  search
} = {}) => {
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];

  if (start_date) {
    where += ' AND expense_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND expense_date <= ?';
    params.push(end_date);
  }
  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }
  if (is_cogs !== undefined && is_cogs !== '') {
    where += ' AND is_cogs = ?';
    params.push(is_cogs ? 1 : 0);
  }
  if (search) {
    where += ' AND (title LIKE ? OR category LIKE ? OR notes LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [countRes] = await query(
    `SELECT COUNT(*) as total FROM expenses WHERE ${where}`,
    params
  );
  const total = countRes ? countRes.total : 0;

  const expenses = await query(
    `SELECT * FROM expenses
     WHERE ${where}
     ORDER BY expense_date DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  return { expenses, total };
};

const getById = async (id) => {
  const rows = await query('SELECT * FROM expenses WHERE id = ?', [id]);
  return rows[0] || null;
};

const create = async (data) => {
  const result = await query(
    `INSERT INTO expenses (store_id, expense_date, title, category, amount, is_cogs, notes)
     VALUES (1, ?, ?, ?, ?, ?, ?)`,
    [
      data.expense_date || new Date().toISOString().slice(0, 10),
      data.title,
      data.category,
      parseFloat(data.amount) || 0,
      data.is_cogs ? 1 : 0,
      data.notes || null
    ]
  );
  return result.insertId;
};

const update = async (id, data) => {
  const fields = [];
  const params = [];

  if (data.expense_date !== undefined) { fields.push('expense_date = ?'); params.push(data.expense_date); }
  if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
  if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category); }
  if (data.amount !== undefined) { fields.push('amount = ?'); params.push(parseFloat(data.amount) || 0); }
  if (data.is_cogs !== undefined) { fields.push('is_cogs = ?'); params.push(data.is_cogs ? 1 : 0); }
  if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes); }

  if (fields.length === 0) return;

  params.push(id);
  await query(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`, params);
};

const deleteExpense = async (id) => {
  await query('DELETE FROM expenses WHERE id = ?', [id]);
};

/**
 * Overheads for Period (excludes any category flagged as is_cogs = 1)
 */
const getPeriodOverheads = async ({ start_date, end_date } = {}) => {
  let where = 'is_cogs = 0';
  const params = [];

  if (start_date) {
    where += ' AND expense_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND expense_date <= ?';
    params.push(end_date);
  }

  const [row] = await query(
    `SELECT 
      COALESCE(SUM(amount), 0) as total_overheads,
      COUNT(*) as overhead_count
     FROM expenses
     WHERE ${where}`,
    params
  );

  const byCategory = await query(
    `SELECT 
      category,
      COALESCE(SUM(amount), 0) as total_amount,
      COUNT(*) as count
     FROM expenses
     WHERE ${where}
     GROUP BY category
     ORDER BY total_amount DESC`,
    params
  );

  return {
    totalOverheads: Number(row?.total_overheads || 0),
    overheadCount: Number(row?.overhead_count || 0),
    byCategory: byCategory.map(c => ({
      category: c.category,
      amount: Number(c.total_amount),
      count: Number(c.count)
    }))
  };
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteExpense,
  getPeriodOverheads
};
