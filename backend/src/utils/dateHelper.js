'use strict';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

const toUTC = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
};

const nowUTC = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d) ? null : d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
};

const formatDateTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d) ? null : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
};

const startOfDayUTC = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return isNaN(d) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
};

const endOfDayUTC = (dateStr) => {
  const d = new Date(dateStr + 'T23:59:59+05:30');
  return isNaN(d) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
};

module.exports = { toUTC, nowUTC, formatDate, formatDateTime, startOfDayUTC, endOfDayUTC };
