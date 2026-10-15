'use strict';
const router = require('express').Router();
const ctrl = require('./dashboardController');
const { authenticate } = require('../../middleware/authMiddleware');

router.use(authenticate);
router.get('/', ctrl.getSummary);
router.get('/summary', ctrl.getSummary);
router.get('/trend', ctrl.getTrend);
router.get('/channels', ctrl.getChannelPerformance);
router.get('/top-products', ctrl.getTopContributionProducts);

module.exports = router;
