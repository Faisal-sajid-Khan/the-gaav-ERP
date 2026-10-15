'use strict';
const router = require('express').Router();
const ctrl = require('./settingsController');
const { authenticate, requireRole } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/', ctrl.getSettings);
router.put('/', requireRole('admin'), ctrl.updateSettings);
router.put('/shopify', requireRole('admin'), ctrl.updateShopifyConfig);

module.exports = router;
