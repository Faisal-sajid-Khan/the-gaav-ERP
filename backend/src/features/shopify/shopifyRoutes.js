'use strict';
const router = require('express').Router();
const ctrl = require('./shopifyController');
const { authenticate, requireRole } = require('../../middleware/authMiddleware');

// Public webhook receiver (Shopify signs requests with HMAC)
router.post('/webhook', ctrl.handleWebhook);

// Protected API routes
router.use(authenticate);
router.get('/test-connection', ctrl.testConnection);
router.get('/locations', ctrl.getLocations);
router.post('/sync-products', requireRole('admin', 'manager'), ctrl.syncProducts);
router.post('/sync-orders', requireRole('admin', 'manager'), ctrl.syncOrders);
router.post('/sync-inventory', requireRole('admin', 'manager'), ctrl.syncInventoryToShopify);
router.post('/push-order/:orderId', requireRole('admin', 'manager'), ctrl.pushOrder);
router.get('/webhooks', requireRole('admin', 'manager'), ctrl.getWebhooks);
router.post('/register-webhooks', requireRole('admin', 'manager'), ctrl.registerWebhooks);
router.get('/webhook-events', ctrl.getWebhookEvents);
router.post('/simulate-webhook', requireRole('admin', 'manager'), ctrl.simulateWebhook);

module.exports = router;
