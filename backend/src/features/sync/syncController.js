'use strict';
const model = require('./syncModel');
const { success, error, paginated } = require('../../utils/responseHelper');
const { auditLog } = require('../../utils/auditLogger');
const { processPendingJobs } = require('./syncQueue');

const getJobs = async (req, res, next) => {
  try {
    const { status, job_type, page = 1, limit = 20 } = req.query;
    const { jobs, total } = await model.getJobs({ status, job_type, page, limit });
    return paginated(res, jobs, total, page, limit);
  } catch (err) { next(err); }
};

const retryJob = async (req, res, next) => {
  try {
    const job = await model.getById(req.params.id);
    if (!job) return error(res, 'Job not found', 404);
    await model.retryJob(req.params.id);
    await auditLog({
      userId: req.user?.id,
      action: 'RETRY_SYNC_JOB',
      entityType: 'sync_job',
      entityId: req.params.id,
      ipAddress: req.ip
    });
    // Trigger immediate run
    processPendingJobs();
    return success(res, null, 'Job queued for immediate retry');
  } catch (err) { next(err); }
};

module.exports = { getJobs, retryJob };
