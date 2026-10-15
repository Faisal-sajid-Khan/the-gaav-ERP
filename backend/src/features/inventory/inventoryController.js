'use strict';
const model = require('./inventoryModel');
const { success, error, paginated } = require('../../utils/responseHelper');
const { auditLog } = require('../../utils/auditLogger');

const getBalances = async (req, res, next) => {
  try {
    const { search = '', low_stock, location_id, page = 1, limit = 20 } = req.query;
    const { items, total } = await model.getBalances({ search, low_stock, location_id, page, limit });
    return paginated(res, items, total, page, limit);
  } catch (err) { next(err); }
};

const getMovements = async (req, res, next) => {
  try {
    const { variant_id, movement_type, start_date, end_date, page = 1, limit = 20 } = req.query;
    const { movements, total } = await model.getMovements({ variant_id, movement_type, start_date, end_date, page, limit });
    return paginated(res, movements, total, page, limit);
  } catch (err) { next(err); }
};

const adjustStock = async (req, res, next) => {
  try {
    const { variant_id, location_id, new_qty, reason } = req.body;
    if (variant_id === undefined || new_qty === undefined) {
      return error(res, 'variant_id and new_qty are required', 400);
    }
    const result = await model.adjustStock({
      variant_id,
      location_id,
      new_qty: parseInt(new_qty, 10),
      reason,
      user_id: req.user?.id
    });

    await auditLog({
      userId: req.user?.id,
      action: 'STOCK_ADJUSTMENT',
      entityType: 'inventory_balance',
      entityId: variant_id,
      changes: { new_qty, reason, ...result },
      ipAddress: req.ip
    });

    return success(res, result, 'Stock adjusted successfully');
  } catch (err) { next(err); }
};

const getLocations = async (req, res, next) => {
  try {
    const locations = await model.getLocations();
    return success(res, locations);
  } catch (err) { next(err); }
};

module.exports = {
  getBalances,
  getMovements,
  adjustStock,
  getLocations
};
