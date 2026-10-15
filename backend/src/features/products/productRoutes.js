'use strict';
const router = require('express').Router();
const ctrl = require('./productController');
const { authenticate, requireRole } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', requireRole('admin', 'manager'), ctrl.create);
// Standalone variant routes (before /:id to prevent parameter capture)
router.put('/variants/:variantId', requireRole('admin', 'manager'), ctrl.updateVariant);
router.patch('/variants/:variantId', requireRole('admin', 'manager'), ctrl.updateVariant);
router.get('/variants/:variantId/cost-history', ctrl.getCostHistory);

// Nested product variant routes
router.get('/:id/variants', ctrl.getVariants);
router.post('/:id/variants', requireRole('admin', 'manager'), ctrl.addVariant);
router.put('/:id/variants/:variantId', requireRole('admin', 'manager'), ctrl.updateVariant);
router.patch('/:id/variants/:variantId', requireRole('admin', 'manager'), ctrl.updateVariant);
router.get('/:id/variants/:variantId/cost-history', ctrl.getCostHistory);

// Product CRUD routes
router.get('/:id', ctrl.getById);
router.put('/:id', requireRole('admin', 'manager'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.deactivate);

module.exports = router;
