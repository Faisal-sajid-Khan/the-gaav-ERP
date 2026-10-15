'use strict';
const { query, withTransaction } = require('../../config/db');
const { verifyShopifyWebhook } = require('../../utils/shopifyHmac');
const settingsModel = require('../settings/settingsModel');
const orderModel = require('../orders/orderModel');
const notificationModel = require('../notifications/notificationModel');
const shopifyService = require('./shopifyService');

async function handleWebhook(topic, hmac, rawBody, webhookId) {
  const store = await settingsModel.getStorePrivate(1);
  const secret = store?.shopify_webhook_secret || store?.shopify_client_secret;
  if (!secret) {
    throw new Error('Neither Webhook Secret nor Client Secret is configured in settings');
  }

  // 1. Verify HMAC
  let isValid = verifyShopifyWebhook(rawBody, hmac, secret);
  if (!isValid && store?.shopify_client_secret && secret !== store?.shopify_client_secret) {
    isValid = verifyShopifyWebhook(rawBody, hmac, store.shopify_client_secret);
  }
  if (!isValid) {
    throw new Error('Invalid HMAC signature from Shopify');
  }

  const payload = JSON.parse(rawBody);
  const eventId = webhookId || `${topic}-${payload.id || Date.now()}`;

  // 2. Check idempotency
  const existing = await query('SELECT id, status FROM shopify_webhook_events WHERE shopify_event_id = ?', [eventId]);
  if (existing.length > 0) {
    console.log(`⏭️  Shopify webhook ${eventId} already received, skipping`);
    return { status: 'skipped', message: 'Duplicate webhook' };
  }

  // 3. Log received webhook
  const insertEvent = await query(
    'INSERT INTO shopify_webhook_events (topic, shopify_event_id, payload, status) VALUES (?, ?, ?, ?)',
    [topic, eventId, JSON.stringify(payload), 'processing']
  );
  const logId = insertEvent.insertId;

  try {
    const result = await dispatchWebhookTopic(topic, payload);

    await query(
      'UPDATE shopify_webhook_events SET status = ?, processed_at = NOW() WHERE id = ?',
      ['processed', logId]
    );
    return { status: 'processed', result };
  } catch (err) {
    await query(
      'UPDATE shopify_webhook_events SET status = ?, error_message = ? WHERE id = ?',
      ['failed', err.message, logId]
    );
    throw err;
  }
}

/**
 * Route topics to their respective processors
 */
async function dispatchWebhookTopic(topic, payload) {
  if (topic === 'products/create' || topic === 'products/update') {
    const syncRes = await shopifyService.createOrUpdateProductFromShopify(payload);
    await notificationModel.create({
      title: `Shopify Product ${topic === 'products/create' ? 'Created' : 'Updated'}`,
      message: `Product "${payload.title}" has been synced with ${syncRes.variants.length} variant(s).`,
      type: 'info',
      link: `/products/${syncRes.productId}`
    });
    return syncRes;
  } else if (topic === 'products/delete') {
    const shopifyId = String(payload.id);
    await query('UPDATE products SET is_active = 0 WHERE shopify_product_id = ?', [shopifyId]);
    await query(
      `UPDATE product_variants pv 
       JOIN products p ON pv.product_id = p.id 
       SET pv.is_active = 0 
       WHERE p.shopify_product_id = ?`,
      [shopifyId]
    );
    return { action: 'deactivated', shopifyProductId: shopifyId };
  } else if (topic === 'orders/create' || topic === 'orders/paid') {
    return await processOrderCreate(payload);
  } else if (topic === 'orders/cancelled') {
    return await processOrderCancel(payload);
  } else if (topic === 'inventory_levels/update') {
    return await processInventoryUpdate(payload);
  } else {
    console.log(`ℹ️  Unhandled Shopify webhook topic: ${topic}`);
    return { unhandled: true, topic };
  }
}

/**
 * Ingests an order placed on Shopify into ERP
 */
async function processOrderCreate(shopifyOrder) {
  const shopifyOrderId = String(shopifyOrder.id);

  // Check if order exists
  const existing = await query('SELECT id FROM orders WHERE shopify_order_id = ?', [shopifyOrderId]);
  if (existing.length > 0) {
    return { alreadyExists: true, orderId: existing[0].id };
  }

  // Find Shopify sales channel
  const channels = await query("SELECT id FROM sales_channels WHERE type = 'shopify' LIMIT 1");
  const channelId = channels[0] ? channels[0].id : 1;

  // Process items
  const items = [];
  for (const line of shopifyOrder.line_items || []) {
    let variantId = null;

    if (line.variant_id) {
      const v = await query('SELECT id FROM product_variants WHERE shopify_variant_id = ?', [String(line.variant_id)]);
      if (v[0]) variantId = v[0].id;
    }
    if (!variantId && line.sku) {
      const v = await query('SELECT id FROM product_variants WHERE sku = ?', [line.sku]);
      if (v[0]) variantId = v[0].id;
    }

    // If variant not found by ID or SKU, try by title
    if (!variantId && line.name) {
      const v = await query(
        `SELECT pv.id FROM product_variants pv 
         JOIN products p ON pv.product_id = p.id 
         WHERE p.name = ? OR pv.name = ? LIMIT 1`,
        [line.title || line.name, line.variant_title || 'Default']
      );
      if (v[0]) variantId = v[0].id;
    }

    if (variantId) {
      items.push({
        variant_id: variantId,
        quantity: line.quantity,
        selling_price: parseFloat(line.price) || 0,
        discount: parseFloat(line.total_discount) || 0,
        shopify_line_item_id: String(line.id)
      });
    }
  }

  if (items.length === 0) {
    console.warn(`Shopify order ${shopifyOrder.name} had no matching product variants in ERP`);
    return { skipped: true, reason: 'No matching variants found in ERP' };
  }

  // Shipping charged
  const shippingTotal = (shopifyOrder.shipping_lines || []).reduce((acc, s) => acc + (parseFloat(s.price) || 0), 0);

  // Customer info
  const customerName = shopifyOrder.customer
    ? `${shopifyOrder.customer.first_name || ''} ${shopifyOrder.customer.last_name || ''}`.trim()
    : 'Shopify Customer';
  const customerContact = shopifyOrder.customer?.phone || shopifyOrder.customer?.email || null;

  const orderId = await orderModel.create({
    channel_id: channelId,
    order_number: `SH-${shopifyOrder.order_number || shopifyOrder.name}`,
    shopify_order_id: shopifyOrderId,
    shopify_order_number: String(shopifyOrder.order_number || shopifyOrder.name),
    customer_name: customerName,
    customer_contact: customerContact,
    order_date: (shopifyOrder.created_at || new Date().toISOString()).slice(0, 10),
    status: shopifyOrder.cancelled_at ? 'cancelled' : 'confirmed',
    payment_status: shopifyOrder.financial_status === 'paid' ? 'paid' : 'pending',
    shipping_charged: shippingTotal,
    actual_shipping_expense: 0,
    items,
    shopify_sync_status: 'synced',
    notes: `Imported from Shopify: ${shopifyOrder.name || shopifyOrderId}`
  }, null);

  await notificationModel.create({
    title: `New Shopify Order ${shopifyOrder.name || '#' + shopifyOrderId}`,
    message: `Received order from ${customerName} for ${items.length} item(s).`,
    type: 'success',
    link: `/orders/${orderId}`
  });

  return { success: true, orderId };
}

async function processOrderCancel(shopifyOrder) {
  const shopifyOrderId = String(shopifyOrder.id);
  const rows = await query('SELECT id FROM orders WHERE shopify_order_id = ?', [shopifyOrderId]);
  if (rows[0]) {
    await orderModel.updateStatus(rows[0].id, 'cancelled', null, null);
    await notificationModel.create({
      title: `Shopify Order Cancelled`,
      message: `Order #${shopifyOrderId} was marked cancelled.`,
      type: 'warning',
      link: `/orders/${rows[0].id}`
    });
    return { cancelled: true, orderId: rows[0].id };
  }
  return { notFound: true };
}

async function processInventoryUpdate(inventoryLevel) {
  if (!inventoryLevel.inventory_item_id) return { skipped: true };
  const rows = await query(
    'SELECT id FROM product_variants WHERE shopify_inventory_item_id = ?',
    [String(inventoryLevel.inventory_item_id)]
  );
  if (rows[0]) {
    const variantId = rows[0].id;
    await query(
      `UPDATE inventory_balances 
       SET shopify_available = ?, last_synced_at = NOW() 
       WHERE variant_id = ?`,
      [inventoryLevel.available, variantId]
    );
    return { variantId, updatedStock: inventoryLevel.available };
  }
  return { notFound: true };
}

/**
 * Simulator function for local testing without needing a live Shopify webhook or ngrok
 */
async function simulateWebhook(topic, payload) {
  const eventId = `sim-${topic.replace('/', '_')}-${Date.now()}`;
  const insertEvent = await query(
    'INSERT INTO shopify_webhook_events (topic, shopify_event_id, payload, status) VALUES (?, ?, ?, ?)',
    [topic, eventId, JSON.stringify(payload), 'processing']
  );
  const logId = insertEvent.insertId;

  try {
    const result = await dispatchWebhookTopic(topic, payload);
    await query(
      'UPDATE shopify_webhook_events SET status = ?, processed_at = NOW() WHERE id = ?',
      ['processed', logId]
    );
    return { success: true, eventId, topic, result };
  } catch (err) {
    console.error('❌ SIMULATION ERROR:', err);
    await query(
      'UPDATE shopify_webhook_events SET status = ?, error_message = ? WHERE id = ?',
      ['failed', err.message, logId]
    );
    throw err;
  }
}

module.exports = {
  handleWebhook,
  dispatchWebhookTopic,
  processOrderCreate,
  processOrderCancel,
  processInventoryUpdate,
  simulateWebhook
};
