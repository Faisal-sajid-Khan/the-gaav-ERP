'use strict';
const model = require('./expenseModel');
const { success, created } = require('../../utils/responseHelper');

const getAll = async (req, res, next) => {
  try {
    const { page, limit, start_date, end_date, category, is_cogs, search } = req.query;
    const result = await model.getAll({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
      start_date,
      end_date,
      category,
      is_cogs,
      search
    });
    return success(res, result);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const expense = await model.getById(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found' });
    }
    return success(res, expense);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { title, category, amount, expense_date, is_cogs, notes } = req.body;
    if (!title || !category || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Title, category, and amount are required' });
    }

    const id = await model.create({
      title,
      category,
      amount,
      expense_date,
      is_cogs,
      notes
    });

    const newExpense = await model.getById(id);
    return created(res, newExpense, 'Expense logged successfully');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    await model.update(req.params.id, req.body);
    const updated = await model.getById(req.params.id);
    return success(res, updated, 'Expense updated successfully');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await model.deleteExpense(req.params.id);
    return success(res, null, 'Expense deleted successfully');
  } catch (err) { next(err); }
};

const getOverheads = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const overheads = await model.getPeriodOverheads({ start_date, end_date });
    return success(res, overheads);
  } catch (err) { next(err); }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  getOverheads
};
