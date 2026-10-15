'use strict';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authModel = require('./authModel');
const { success, error } = require('../../utils/responseHelper');
const { auditLog } = require('../../utils/auditLogger');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function signAccess(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'thegaav_erp_jwt_secret_key_2024_production_min32',
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function signRefresh(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || 'thegaav_erp_refresh_secret_key_2024_production',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return error(res, 'Email and password are required', 400);

    const user = await authModel.findByEmail(email);
    if (!user) return error(res, 'Invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return error(res, 'Invalid credentials', 401);

    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user.id);
    const refreshHash = await bcrypt.hash(refreshToken, 10);

    await authModel.updateRefreshToken(user.id, refreshHash);
    await authModel.updateLastLogin(user.id);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    await auditLog({ userId: user.id, action: 'LOGIN', ipAddress: req.ip });

    return success(res, {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    }, 'Login successful');
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      await authModel.clearRefreshToken(userId);
      await auditLog({ userId, action: 'LOGOUT', ipAddress: req.ip });
    }
    res.clearCookie('refreshToken');
    return success(res, null, 'Logged out successfully');
  } catch (err) { next(err); }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return error(res, 'Refresh token missing', 401);

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'thegaav_erp_refresh_secret_key_2024_production');
    } catch {
      return error(res, 'Invalid refresh token', 401);
    }

    const user = await authModel.findById(decoded.id);
    if (!user || !user.is_active) return error(res, 'User not found or inactive', 401);

    const fullUser = await authModel.findByEmail(user.email);
    if (!fullUser?.refresh_token_hash) return error(res, 'Session expired', 401);

    const valid = await bcrypt.compare(token, fullUser.refresh_token_hash);
    if (!valid) return error(res, 'Invalid session', 401);

    const accessToken = signAccess(user);
    return success(res, { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 'Token refreshed');
  } catch (err) { next(err); }
};

const me = async (req, res, next) => {
  try {
    const user = await authModel.findById(req.user.id);
    if (!user) return error(res, 'User not found', 404);
    return success(res, user);
  } catch (err) { next(err); }
};

module.exports = { login, logout, refresh, me };
