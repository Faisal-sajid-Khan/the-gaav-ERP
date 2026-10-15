'use strict';
const https = require('https');
const settingsModel = require('../settings/settingsModel');
const { query } = require('../../config/db');
const { auditLog } = require('../../utils/auditLogger');

async function fetchClientCredentialsToken(domain, clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    });

    const options = {
      hostname: domain,
      port: 443,
      path: '/admin/oauth/access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) {
            resolve(parsed);
          } else {
            const errDetail = parsed.error_description || parsed.errors || parsed.error || `HTTP ${res.statusCode}`;
            reject(new Error(`Failed to obtain Shopify access token: ${errDetail}`));
          }
        } catch (e) {
          if (data.includes('app_not_installed')) {
            reject(new Error(`App Not Installed: The app has not been installed on "${domain}" yet. Go to Shopify Dev Dashboard > Installs > Click "Install app" on this store.`));
          } else {
            const titleMatch = data.match(/<title>(.*?)<\/title>/i);
            const cleanTitle = titleMatch ? titleMatch[1].trim() : `HTTP ${res.statusCode}`;
            reject(new Error(`Shopify Auth Error (${cleanTitle}). Please verify that your Dev Dashboard app is installed on "${domain}".`));
          }
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(postData);
    req.end();
  });
}

async function getCredentials() {
  const store = await settingsModel.getStorePrivate(1);
  if (!store || !store.shopify_domain) {
    throw new Error('Shopify integration is not configured with domain');
  }

  const domain = store.shopify_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // 1. Modern 2026 Dev Dashboard Flow: Client ID + Client Secret
  if (store.shopify_client_id && store.shopify_client_secret) {
    const isTokenValid = store.shopify_access_token && 
      store.shopify_token_expires_at && 
      new Date(store.shopify_token_expires_at).getTime() > Date.now() + 5 * 60 * 1000;

    if (isTokenValid) {
      return {
        domain,
        token: store.shopify_access_token,
        apiVersion: store.shopify_api_version || '2025-01',
        locationId: store.shopify_location_id
      };
    }

    // Exchange Client ID & Secret for 24h Access Token
    const tokenData = await fetchClientCredentialsToken(domain, store.shopify_client_id, store.shopify_client_secret);
    const expiresInSec = tokenData.expires_in || 86400;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);

    await query(
      'UPDATE stores SET shopify_access_token = ?, shopify_token_expires_at = ? WHERE id = ?',
      [tokenData.access_token, expiresAt, store.id]
    );

    return {
      domain,
      token: tokenData.access_token,
      apiVersion: store.shopify_api_version || '2025-01',
      locationId: store.shopify_location_id
    };
  }

  // 2. Fallback: Legacy permanent token (shpat_...)
  if (store.shopify_access_token) {
    return {
      domain,
      token: store.shopify_access_token,
      apiVersion: store.shopify_api_version || '2025-01',
      locationId: store.shopify_location_id
    };
  }

  throw new Error('Shopify credentials missing. Please enter Client ID & Client Secret (or an Access Token) in Shopify Settings.');
}

function requestShopify({ method = 'GET', path, body = null, domain, token, apiVersion }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: domain,
      port: 443,
      path: `/admin/api/${apiVersion}${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const errDetail = parsed.errors ? (typeof parsed.errors === 'string' ? parsed.errors : JSON.stringify(parsed.errors)) : `${res.statusCode} ${res.statusMessage}`;
            reject(new Error(`Shopify API error (${res.statusCode}): ${errDetail}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            const titleMatch = data.match(/<title>(.*?)<\/title>/i);
            const cleanTitle = titleMatch ? titleMatch[1].trim() : `HTTP ${res.statusCode}`;
            reject(new Error(`Shopify API error (${res.statusCode}): ${cleanTitle}`));
          }
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

const testConnection = async () => {
  const creds = await getCredentials();
  const res = await requestShopify({
    method: 'GET',
    path: '/shop.json',
    ...creds
  });
  return res.shop;
};

const getProducts = async ({ limit = 50, since_id = null } = {}) => {
  const creds = await getCredentials();
  let path = `/products.json?limit=${limit}`;
  if (since_id) path += `&since_id=${since_id}`;
  const res = await requestShopify({ method: 'GET', path, ...creds });
  return res.products || [];
};

const getOrders = async ({ status = 'any', limit = 50 } = {}) => {
  const creds = await getCredentials();
  const res = await requestShopify({
    method: 'GET',
    path: `/orders.json?status=${status}&limit=${limit}`,
    ...creds
  });
  return res.orders || [];
};

const getLocations = async () => {
  const creds = await getCredentials();
  const res = await requestShopify({ method: 'GET', path: '/locations.json', ...creds });
  return res.locations || [];
};

const setInventoryLevel = async ({ inventory_item_id, location_id, available }) => {
  const creds = await getCredentials();
  const locId = location_id || creds.locationId;
  if (!locId) throw new Error('Shopify location ID is required for inventory sync');

  const res = await requestShopify({
    method: 'POST',
    path: '/inventory_levels/set.json',
    body: {
      location_id: locId,
      inventory_item_id,
      available
    },
    ...creds
  });
  return res.inventory_level;
};

const adjustInventoryLevel = async ({ inventory_item_id, location_id, available_adjustment }) => {
  const creds = await getCredentials();
  const locId = location_id || creds.locationId;
  if (!locId) throw new Error('Shopify location ID is required for inventory sync');

  const res = await requestShopify({
    method: 'POST',
    path: '/inventory_levels/adjust.json',
    body: {
      location_id: locId,
      inventory_item_id,
      available_adjustment
    },
    ...creds
  });
  return res.inventory_level;
};

/**
 * Creates/Updates a product in ERP from a Shopify product object.
 * Used by webhooks (products/create, products/update) and bulk sync.
 */
const createOrUpdateProductFromShopify = async (sp, storeId = 1) => {
  const shopifyId = String(sp.id);
  const title = sp.title || 'Untitled Product';
  const desc = sp.body_html ? sp.body_html.replace(/<[^>]*>?/gm, '').trim() : null;
  const primarySku = sp.variants?.[0]?.sku || null;

  // Check if product exists by shopify_product_id or title
  const existing = await query(
    'SELECT id FROM products WHERE shopify_product_id = ? OR name = ? LIMIT 1',
    [shopifyId, title]
  );

  let productId;
  let action = 'created';
  if (existing.length > 0) {
    productId = existing[0].id;
    action = 'updated';
    await query(
      `UPDATE products SET 
        name = ?, 
        description = ?, 
        shopify_product_id = ?,
        is_active = 1
       WHERE id = ?`,
      [title, desc, shopifyId, productId]
    );
  } else {
    const insertRes = await query(
      `INSERT INTO products (store_id, name, sku, description, shopify_product_id, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [storeId, title, primarySku, desc, shopifyId]
    );
    productId = insertRes.insertId;
  }

  // Get primary inventory location
  const locRows = await query('SELECT id FROM inventory_locations WHERE store_id = ? AND is_primary = 1 LIMIT 1', [storeId]);
  const locationId = locRows[0] ? locRows[0].id : 1;

  // Process all variants
  const variants = [];
  for (const sv of sp.variants || []) {
    const vShopifyId = String(sv.id);
    const invItemId = sv.inventory_item_id ? String(sv.inventory_item_id) : null;
    const vTitle = sv.title === 'Default Title' ? 'Default' : (sv.title || 'Default');
    const price = parseFloat(sv.price) || 0;
    const sku = sv.sku || null;
    const invQty = typeof sv.inventory_quantity === 'number' ? sv.inventory_quantity : 0;

    const vExisting = await query(
      'SELECT id, selling_price, manufacturing_cost FROM product_variants WHERE shopify_variant_id = ? OR (product_id = ? AND sku = ? AND sku IS NOT NULL) LIMIT 1',
      [vShopifyId, productId, sku]
    );

    let variantId;
    if (vExisting.length > 0) {
      variantId = vExisting[0].id;
      await query(
        `UPDATE product_variants SET 
          name = ?,
          shopify_variant_id = ?, 
          shopify_inventory_item_id = COALESCE(?, shopify_inventory_item_id),
          selling_price = ?,
          sku = COALESCE(sku, ?),
          is_active = 1
         WHERE id = ?`,
        [vTitle, vShopifyId, invItemId, price, sku, variantId]
      );
    } else {
      const vInsert = await query(
        `INSERT INTO product_variants (
          product_id, name, sku, shopify_variant_id, shopify_inventory_item_id,
          selling_price, manufacturing_cost, packaging_cost, other_cost, reorder_threshold, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 10, 1)`,
        [productId, vTitle, sku, vShopifyId, invItemId, price]
      );
      variantId = vInsert.insertId;
    }

    // Sync inventory balance
    const balRows = await query(
      'SELECT id, available_qty FROM inventory_balances WHERE variant_id = ? AND location_id = ?',
      [variantId, locationId]
    );

    if (balRows.length > 0) {
      await query(
        `UPDATE inventory_balances 
         SET shopify_available = ?, 
             available_qty = CASE WHEN available_qty = 0 THEN ? ELSE available_qty END,
             last_synced_at = NOW() 
         WHERE id = ?`,
        [invQty, invQty, balRows[0].id]
      );
    } else {
      await query(
        `INSERT INTO inventory_balances (variant_id, location_id, available_qty, shopify_available, last_synced_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [variantId, locationId, invQty, invQty]
      );
    }

    variants.push({ id: variantId, shopifyVariantId: vShopifyId, name: vTitle, sku, price, inventory_quantity: invQty });
  }

  return { productId, name: title, action, variants };
};

/**
 * Pushes an ERP order (e.g. from WhatsApp, Instagram, Offline, Distributor)
 * directly into Shopify as a custom/external channel order with inventory_behaviour: decrement_obeying_policy.
 * This ensures:
 * 1. The order shows up in Shopify Admin under Orders!
 * 2. Shopify decrements the variant inventory count automatically!
 * 3. The centralized inventory in Shopify stays synchronized!
 */
const pushOrderToShopify = async (orderId) => {
  const orderRows = await query(
    `SELECT o.*, sc.name as channel_name, sc.type as channel_type
     FROM orders o
     JOIN sales_channels sc ON o.channel_id = sc.id
     WHERE o.id = ?`,
    [orderId]
  );

  if (!orderRows[0]) throw new Error(`Order #${orderId} not found`);
  const order = orderRows[0];

  if (order.shopify_order_id) {
    return {
      success: true,
      alreadySynced: true,
      shopify_order_id: order.shopify_order_id,
      shopify_order_number: order.shopify_order_number
    };
  }

  const items = await query(
    `SELECT oi.*, pv.shopify_variant_id, pv.shopify_inventory_item_id, pv.name as variant_name, pv.sku as variant_sku, p.name as product_name
     FROM order_items oi
     JOIN product_variants pv ON oi.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  if (items.length === 0) throw new Error(`Order #${orderId} has no line items`);

  // Build Shopify line items
  const line_items = items.map(item => {
    if (item.shopify_variant_id) {
      return {
        variant_id: parseInt(item.shopify_variant_id, 10),
        quantity: item.quantity,
        price: parseFloat(item.selling_price).toFixed(2),
      };
    } else {
      return {
        title: `${item.product_name} - ${item.variant_name}`,
        price: parseFloat(item.selling_price).toFixed(2),
        quantity: item.quantity,
        sku: item.variant_sku || undefined
      };
    }
  });

  const creds = await getCredentials();

  const customerNameParts = (order.customer_name || 'Direct Customer').trim().split(' ');
  const firstName = customerNameParts[0] || 'Customer';
  const lastName = customerNameParts.slice(1).join(' ') || '';

  const email = order.customer_email || (order.customer_contact && order.customer_contact.includes('@') ? order.customer_contact : undefined);
  const phone = order.customer_phone || (order.customer_contact && !order.customer_contact.includes('@') && /^\+?[\d\s-]{7,15}$/.test(order.customer_contact) ? order.customer_contact : undefined);

  // Total discounts applied to order (both item-level and order-level)
  const totalDiscount = parseFloat(order.discount_total || 0);

  const shopifyPayload = {
    order: {
      source_name: `The Gaav ERP - ${order.channel_name}`,
      tags: `ERP, Channel:${order.channel_name}, ERP-Order:${order.order_number}`,
      note: order.notes ? `${order.notes} (Source: ${order.channel_name} via The Gaav ERP)` : `Order ${order.order_number} created via The Gaav ERP (${order.channel_name})`,
      financial_status: order.payment_status === 'paid' ? 'paid' : 'pending',
      // CRITICAL: Tells Shopify to automatically deduct stock from Shopify's centralized inventory
      inventory_behaviour: 'decrement_obeying_policy',
      customer: {
        first_name: firstName,
        last_name: lastName,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {})
      },
      line_items,
      shipping_lines: parseFloat(order.shipping_charged) > 0 ? [{
        title: 'Standard Shipping',
        price: parseFloat(order.shipping_charged).toFixed(2)
      }] : [],
      ...(totalDiscount > 0 ? {
        discount_codes: [{
          code: 'ERP_DISCOUNT',
          amount: totalDiscount.toFixed(2),
          type: 'fixed_amount'
        }]
      } : {})
    }
  };

  if (order.shipping_address) {
    let street = order.shipping_address;
    let city = '';
    let province = '';
    let zip = '';
    let country = 'India';

    try {
      const parsed = JSON.parse(order.shipping_address);
      if (typeof parsed === 'object' && parsed !== null) {
        street = parsed.address1 || parsed.street || '';
        if (parsed.address2) street += ', ' + parsed.address2;
        city = parsed.city || '';
        province = parsed.province || parsed.state || '';
        zip = parsed.zip || parsed.pincode || '';
        country = parsed.country || 'India';
      }
    } catch (_) {
      // Plain text address
    }

    const addressObj = {
      first_name: firstName,
      last_name: lastName,
      address1: street || 'Address',
      city: city || undefined,
      province: province || undefined,
      zip: zip || undefined,
      country: country || 'India',
      country_code: 'IN',
      ...(phone ? { phone } : {})
    };
    shopifyPayload.order.shipping_address = addressObj;
    shopifyPayload.order.billing_address = addressObj;
  }

  const response = await requestShopify({
    method: 'POST',
    path: '/orders.json',
    body: shopifyPayload,
    ...creds
  });

  const createdShopifyOrder = response.order;
  if (!createdShopifyOrder || !createdShopifyOrder.id) {
    throw new Error('Invalid response from Shopify when creating order');
  }

  // Update order with Shopify IDs
  await query(
    `UPDATE orders SET 
      shopify_order_id = ?, 
      shopify_order_number = ?, 
      shopify_sync_status = 'synced', 
      shopify_synced_at = NOW() 
     WHERE id = ?`,
    [
      String(createdShopifyOrder.id),
      String(createdShopifyOrder.order_number || createdShopifyOrder.name),
      orderId
    ]
  );

  // Update shopify_available in inventory_balances if tracked
  for (const item of items) {
    if (item.shopify_inventory_item_id) {
      await query(
        `UPDATE inventory_balances 
         SET shopify_available = GREATEST(0, COALESCE(shopify_available, available_qty) - ?),
             last_synced_at = NOW()
         WHERE variant_id = ?`,
        [item.quantity, item.variant_id]
      );
    }
  }

  await auditLog({
    userId: order.created_by,
    action: 'ORDER_PUSHED_TO_SHOPIFY',
    entityType: 'order',
    entityId: orderId,
    changes: {
      shopify_order_id: createdShopifyOrder.id,
      shopify_order_number: createdShopifyOrder.order_number || createdShopifyOrder.name,
      channel: order.channel_name
    }
  });

  return {
    success: true,
    shopify_order_id: String(createdShopifyOrder.id),
    shopify_order_number: String(createdShopifyOrder.order_number || createdShopifyOrder.name)
  };
};

const getWebhooks = async () => {
  const creds = await getCredentials();
  const res = await requestShopify({ method: 'GET', path: '/webhooks.json', ...creds });
  return res.webhooks || [];
};

const registerWebhooks = async (callbackUrl) => {
  const creds = await getCredentials();
  const topics = [
    'products/create',
    'products/update',
    'products/delete',
    'orders/create',
    'orders/paid',
    'orders/cancelled',
    'inventory_levels/update'
  ];

  const results = [];
  for (const topic of topics) {
    try {
      const res = await requestShopify({
        method: 'POST',
        path: '/webhooks.json',
        body: {
          webhook: {
            topic,
            address: callbackUrl,
            format: 'json'
          }
        },
        ...creds
      });
      results.push({ topic, status: 'registered', id: res.webhook?.id });
    } catch (err) {
      results.push({ topic, status: 'error', error: err.message });
    }
  }
  return results;
};

module.exports = {
  getCredentials,
  testConnection,
  getProducts,
  getOrders,
  getLocations,
  setInventoryLevel,
  adjustInventoryLevel,
  createOrUpdateProductFromShopify,
  pushOrderToShopify,
  getWebhooks,
  registerWebhooks
};
