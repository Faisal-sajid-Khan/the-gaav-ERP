'use strict';
const router = require('express').Router();
const ctrl = require('./expenseController');
const { authenticate } = require('../../middleware/authMiddleware');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/overheads', ctrl.getOverheads);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
