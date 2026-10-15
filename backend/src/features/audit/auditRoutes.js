'use strict';
const router = require('express').Router();
const ctrl = require('./auditController');
const { authenticate, requireRole } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/', requireRole('admin', 'manager'), ctrl.getAll);

module.exports = router;
