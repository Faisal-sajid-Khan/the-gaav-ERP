'use strict';
const router = require('express').Router();
const ctrl = require('./notificationController');
const { authenticate } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.patch('/:id/read', ctrl.markAsRead);
router.post('/read-all', ctrl.markAllAsRead);

module.exports = router;
