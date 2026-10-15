'use strict';
const model = require('./channelModel');
const { success, error } = require('../../utils/responseHelper');
const { auditLog } = require('../../utils/auditLogger');

const getAll = async (req, res, next) => {
  try {
    const channels = await model.getAll(req.query.active_only === 'true');
    return success(res, channels);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const ch = await model.getById(req.params.id);
    if (!ch) return error(res, 'Channel not found', 404);
    return success(res, ch);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, type, fee_type, fee_value, config } = req.body;
    if (!name) return error(res, 'Channel name is required', 400);
    const id = await model.create({ name, type, fee_type, fee_value, config });
    await auditLog({ userId: req.user?.id, action: 'CHANNEL_CREATED', entityType: 'channel', entityId: id, ipAddress: req.ip });
    return success(res, await model.getById(id), 'Channel created successfully', 201);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const ch = await model.getById(req.params.id);
    if (!ch) return error(res, 'Channel not found', 404);
    await model.update(req.params.id, { ...ch, ...req.body });
    await auditLog({ userId: req.user?.id, action: 'CHANNEL_UPDATED', entityType: 'channel', entityId: req.params.id, ipAddress: req.ip });
    return success(res, await model.getById(req.params.id), 'Channel updated successfully');
  } catch (err) { next(err); }
};

const toggle = async (req, res, next) => {
  try {
    await model.toggleActive(req.params.id);
    await auditLog({ userId: req.user?.id, action: 'CHANNEL_TOGGLED', entityType: 'channel', entityId: req.params.id, ipAddress: req.ip });
    return success(res, null, 'Channel status toggled');
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, toggle };
