'use strict';

const success = (res, data = null, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const created = (res, data = null, message = 'Created successfully') =>
  res.status(201).json({ success: true, message, data });

const error = (res, message = 'Error', statusCode = 400, errors = null) =>
  res.status(statusCode).json({ success: false, message, errors });

const paginated = (res, data, total, page, limit, message = 'Success') =>
  res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total: Number(total),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(Number(total) / (parseInt(limit, 10) || 20))
    }
  });

module.exports = { success, created, error, paginated };
