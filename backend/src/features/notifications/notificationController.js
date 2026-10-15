'use strict';
const model = require('./notificationModel');
const { success, error } = require('../../utils/responseHelper');

const getAll = async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const notifications = await model.getAll(req.user.id, unreadOnly);
    const unreadCount = await model.getUnreadCount(req.user.id);
    return success(res, { notifications, unreadCount });
  } catch (err) { next(err); }
};

const markAsRead = async (req, res, next) => {
  try {
    await model.markAsRead(req.params.id, req.user.id);
    return success(res, null, 'Notification marked as read');
  } catch (err) { next(err); }
};

const markAllAsRead = async (req, res, next) => {
  try {
    await model.markAllAsRead(req.user.id);
    return success(res, null, 'All notifications marked as read');
  } catch (err) { next(err); }
};

module.exports = { getAll, markAsRead, markAllAsRead };
