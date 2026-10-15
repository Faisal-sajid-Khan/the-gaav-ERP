'use strict';
const userModel = require('./userModel');
const { success, error } = require('../../utils/responseHelper');
const { auditLog } = require('../../utils/auditLogger');

const getAll = async (req, res, next) => {
  try {
    const users = await userModel.getAll();
    return success(res, users);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const user = await userModel.getById(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    return success(res, user);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return error(res, 'Name, email, and password are required', 400);
    if (await userModel.emailExists(email)) return error(res, 'Email already exists', 409);
    const id = await userModel.create({ name, email, password, role });
    await auditLog({ userId: req.user?.id, action: 'CREATE_USER', entityType: 'user', entityId: id, ipAddress: req.ip });
    const user = await userModel.getById(id);
    return success(res, user, 'User created', 201);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { name, role, is_active } = req.body;
    const user = await userModel.getById(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    await userModel.update(req.params.id, {
      name: name || user.name,
      role: role || user.role,
      is_active: is_active !== undefined ? is_active : user.is_active
    });
    await auditLog({ userId: req.user?.id, action: 'UPDATE_USER', entityType: 'user', entityId: req.params.id, changes: { name, role, is_active }, ipAddress: req.ip });
    return success(res, await userModel.getById(req.params.id), 'User updated');
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) return error(res, 'Password must be at least 8 characters', 400);
    // Managers/viewers can only change their own password, admins can change any
    if (req.user?.role !== 'admin' && req.user?.id !== parseInt(req.params.id, 10)) {
      return error(res, 'Insufficient permissions', 403);
    }
    await userModel.changePassword(req.params.id, new_password);
    await auditLog({ userId: req.user?.id, action: 'CHANGE_PASSWORD', entityType: 'user', entityId: req.params.id, ipAddress: req.ip });
    return success(res, null, 'Password changed successfully');
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, changePassword };
