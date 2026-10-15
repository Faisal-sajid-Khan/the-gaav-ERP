'use strict';
const router = require('express').Router();
const ctrl = require('./inventoryController');
const { authenticate, requireRole } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/', ctrl.getBalances);
router.get('/balances', ctrl.getBalances);
router.get('/movements', ctrl.getMovements);
router.post('/adjust', requireRole('admin', 'manager'), ctrl.adjustStock);
router.get('/locations', ctrl.getLocations);

module.exports = router;
