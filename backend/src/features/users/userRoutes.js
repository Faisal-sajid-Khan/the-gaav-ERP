'use strict';
const router = require('express').Router();
const ctrl = require('./userController');
const { authenticate, requireRole } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/', requireRole('admin'), ctrl.getAll);
router.post('/', requireRole('admin'), ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', requireRole('admin'), ctrl.update);
router.put('/:id/password', ctrl.changePassword);

module.exports = router;
