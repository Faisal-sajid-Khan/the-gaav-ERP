'use strict';
const { query } = require('../../config/db');

const getJobs = async ({ status, job_type, page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (job_type) {
    where += ' AND job_type = ?';
    params.push(job_type);
  }

  const [countRes] = await query(`SELECT COUNT(*) as total FROM sync_jobs WHERE ${where}`, params);
  const total = countRes ? countRes.total : 0;

  const jobs = await query(
    `SELECT * FROM sync_jobs 
     WHERE ${where} 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  return { jobs, total };
};

const getById = async (id) => {
  const rows = await query('SELECT * FROM sync_jobs WHERE id = ?', [id]);
  return rows[0] || null;
};

const createJob = async ({ job_type, reference_type, reference_id, payload }) => {
  const res = await query(
    `INSERT INTO sync_jobs (store_id, job_type, reference_type, reference_id, payload, status)
     VALUES (1, ?, ?, ?, ?, 'pending')`,
    [job_type, reference_type || null, reference_id || null, payload ? JSON.stringify(payload) : null]
  );
  return res.insertId;
};

const retryJob = async (id) => {
  await query(
    `UPDATE sync_jobs 
     SET status = 'pending', attempts = 0, last_error = NULL, next_retry_at = NOW() 
     WHERE id = ?`,
    [id]
  );
};

module.exports = { getJobs, getById, createJob, retryJob };
