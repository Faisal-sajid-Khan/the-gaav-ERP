'use strict';
const model = require('./auditModel');
const { paginated } = require('../../utils/responseHelper');

const getAll = async (req, res, next) => {
  try {
    const { action, entity_type, user_id, start_date, end_date, page = 1, limit = 25 } = req.query;
    const { logs, total } = await model.getAll({ action, entity_type, user_id, start_date, end_date, page, limit });
    return paginated(res, logs, total, page, limit);
  } catch (err) { next(err); }
};

module.exports = { getAll };
