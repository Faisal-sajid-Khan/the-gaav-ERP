'use strict';
const router = require('express').Router();
const ctrl = require('./channelController');
const { authenticate, requireRole } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', requireRole('admin', 'manager'), ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', requireRole('admin', 'manager'), ctrl.update);
router.patch('/:id/toggle', requireRole('admin', 'manager'), ctrl.toggle);

module.exports = router;
