'use strict';
const shopifyService = require('./shopifyService');
const webhookHandler = require('./shopifyWebhookHandler');
const { query } = require('../../config/db');
const { success, error, paginated } = require('../../utils/responseHelper');
const { auditLog } = require('../../utils/auditLogger');

const testConnection = async (req, res, next) => {
  try {
    const shop = await shopifyService.testConnection();
    return success(res, shop, 'Connected to Shopify successfully');
  } catch (err) {
    return error(res, `Shopify connection failed: ${err.message}`, 400);
  }
};

const syncProducts = async (req, res, next) => {
  try {
    const shopifyProducts = await shopifyService.getProducts({ limit: 100 });
    let createdCount = 0;
    let updatedCount = 0;

    for (const sp of shopifyProducts) {
      const result = await shopifyService.createOrUpdateProductFromShopify(sp);
      if (result.action === 'created') createdCount++;
      else updatedCount++;
    }

    await auditLog({
      userId: req.user?.id,
      action: 'SYNC_SHOPIFY_PRODUCTS',
      entityType: 'shopify',
      changes: { createdCount, updatedCount, total: shopifyProducts.length },
      ipAddress: req.ip
    });

    return success(res, { createdCount, updatedCount, totalProcessed: shopifyProducts.length }, 'Products synced from Shopify');
  } catch (err) { next(err); }
};

const syncOrders = async (req, res, next) => {
  try {
    const orders = await shopifyService.getOrders({ limit: 50 });
    let imported = 0;

    for (const ord of orders) {
      try {
        const res = await webhookHandler.processOrderCreate(ord);
        if (res.success) imported++;
      } catch (err) {
        console.error(`Failed to import order ${ord.name}:`, err.message);
      }
    }

    await auditLog({
      userId: req.user?.id,
      action: 'SYNC_SHOPIFY_ORDERS',
      entityType: 'shopify',
      changes: { imported, total: orders.length },
      ipAddress: req.ip
    });

    return success(res, { imported, totalFetched: orders.length }, 'Orders synced from Shopify');
  } catch (err) { next(err); }
};

const syncInventoryToShopify = async (req, res, next) => {
  try {
    const variants = await query(
      `SELECT pv.id, pv.shopify_inventory_item_id, ib.available_qty
       FROM product_variants pv
       JOIN inventory_balances ib ON ib.variant_id = pv.id
       WHERE pv.shopify_inventory_item_id IS NOT NULL AND pv.is_active = 1`
    );

    let synced = 0;
    const errors = [];

    for (const v of variants) {
      try {
        await shopifyService.setInventoryLevel({
          inventory_item_id: v.shopify_inventory_item_id,
          available: v.available_qty
        });
        synced++;
        await query(
          'UPDATE inventory_balances SET shopify_available = ?, last_synced_at = NOW() WHERE variant_id = ?',
          [v.available_qty, v.id]
        );
      } catch (err) {
        errors.push({ variant_id: v.id, error: err.message });
      }
    }

    return success(res, { synced, errors }, 'Inventory pushed to Shopify');
  } catch (err) { next(err); }
};

const pushOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const result = await shopifyService.pushOrderToShopify(orderId);
    return success(res, result, 'Order successfully pushed to Shopify and inventory decremented in Shopify');
  } catch (err) {
    return error(res, `Failed to push order to Shopify: ${err.message}`, 400);
  }
};

const getWebhooks = async (req, res, next) => {
  try {
    const webhooks = await shopifyService.getWebhooks();
    return success(res, webhooks);
  } catch (err) { next(err); }
};

const registerWebhooks = async (req, res, next) => {
  try {
    const { callbackUrl } = req.body;
    if (!callbackUrl) {
      return error(res, 'Public Webhook Callback URL is required (e.g. from ngrok or cloudflare)', 400);
    }
    const results = await shopifyService.registerWebhooks(callbackUrl);
    return success(res, results, 'Webhooks registered on Shopify');
  } catch (err) { next(err); }
};

const getWebhookEvents = async (req, res, next) => {
  try {
    const events = await query(
      `SELECT id, topic, shopify_event_id, status, error_message, processed_at, created_at,
              JSON_EXTRACT(payload, '$.title') as product_title,
              JSON_EXTRACT(payload, '$.name') as order_name,
              JSON_EXTRACT(payload, '$.id') as entity_id
       FROM shopify_webhook_events
       ORDER BY id DESC
       LIMIT 50`
    );
    return success(res, events);
  } catch (err) { next(err); }
};

const simulateWebhook = async (req, res, next) => {
  try {
    const { topic, payload } = req.body;
    if (!topic || !payload) {
      return error(res, 'Both topic and payload are required for simulation', 400);
    }
    const result = await webhookHandler.simulateWebhook(topic, payload);
    return success(res, result, `Simulated webhook "${topic}" executed successfully`);
  } catch (err) {
    return error(res, `Webhook simulation failed: ${err.message}`, 400);
  }
};

const handleWebhook = async (req, res) => {
  const topic = req.headers['x-shopify-topic'];
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const webhookId = req.headers['x-shopify-webhook-id'];
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (!topic || !hmac) {
    return res.status(400).send('Missing webhook headers');
  }

  try {
    const result = await webhookHandler.handleWebhook(topic, hmac, rawBody, webhookId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(err.message);
  }
};

const getLocations = async (req, res, next) => {
  try {
    const locations = await shopifyService.getLocations();
    return success(res, locations, 'Locations fetched from Shopify');
  } catch (err) {
    return error(res, `Failed to fetch locations: ${err.message}`, 400);
  }
};

module.exports = {
  testConnection,
  syncProducts,
  syncOrders,
  syncInventoryToShopify,
  pushOrder,
  getLocations,
  getWebhooks,
  registerWebhooks,
  getWebhookEvents,
  simulateWebhook,
  handleWebhook
};
