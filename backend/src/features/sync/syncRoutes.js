'use strict';
const router = require('express').Router();
const ctrl = require('./syncController');
const { authenticate, requireRole } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/jobs', ctrl.getJobs);
router.post('/jobs/:id/retry', requireRole('admin', 'manager'), ctrl.retryJob);

module.exports = router;
