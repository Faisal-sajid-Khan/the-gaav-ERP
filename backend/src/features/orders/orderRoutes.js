'use strict';
const router = require('express').Router();
const ctrl = require('./orderController');
const { authenticate, requireRole } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', requireRole('admin', 'manager'), ctrl.create);
router.post('/preview-calculation', ctrl.previewCalculation);
router.get('/:id', ctrl.getById);
router.patch('/:id/status', requireRole('admin', 'manager'), ctrl.updateStatus);
router.post('/:id/refunds', requireRole('admin', 'manager'), ctrl.addRefund);
router.post('/:id/recalculate', requireRole('admin', 'manager'), ctrl.recalculate);

module.exports = router;
