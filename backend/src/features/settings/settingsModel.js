'use strict';
const { query } = require('../../config/db');

const getStore = async (storeId = 1) => {
  const rows = await query(
    `SELECT 
      id, name, timezone, currency, currency_symbol,
      tax_rate, tax_registered, global_reorder_threshold, shared_unit_costs,
      shopify_domain, shopify_client_id, shopify_location_id, shopify_api_version,
      sync_enabled, sync_status, last_sync_at, created_at, updated_at,
      CASE WHEN shopify_access_token IS NOT NULL AND shopify_access_token != '' THEN 1 ELSE 0 END as has_shopify_token,
      CASE WHEN shopify_client_secret IS NOT NULL AND shopify_client_secret != '' THEN 1 ELSE 0 END as has_client_secret,
      CASE WHEN shopify_webhook_secret IS NOT NULL AND shopify_webhook_secret != '' THEN 1 ELSE 0 END as has_webhook_secret
     FROM stores 
     WHERE id = ?`,
    [storeId]
  );
  if (rows[0] && typeof rows[0].shared_unit_costs === 'string') {
    try {
      rows[0].shared_unit_costs = JSON.parse(rows[0].shared_unit_costs);
    } catch {
      rows[0].shared_unit_costs = [];
    }
  }
  return rows[0] || null;
};

const getStorePrivate = async (storeId = 1) => {
  const rows = await query('SELECT * FROM stores WHERE id = ?', [storeId]);
  return rows[0] || null;
};

const updateStore = async (storeId = 1, data) => {
  const fields = [];
  const params = [];

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
  if (data.timezone !== undefined) { fields.push('timezone = ?'); params.push(data.timezone); }
  if (data.currency !== undefined) { fields.push('currency = ?'); params.push(data.currency); }
  if (data.currency_symbol !== undefined) { fields.push('currency_symbol = ?'); params.push(data.currency_symbol); }
  if (data.tax_rate !== undefined) { fields.push('tax_rate = ?'); params.push(parseFloat(data.tax_rate) || 0); }
  if (data.tax_registered !== undefined) { fields.push('tax_registered = ?'); params.push(data.tax_registered ? 1 : 0); }
  if (data.global_reorder_threshold !== undefined) { fields.push('global_reorder_threshold = ?'); params.push(parseInt(data.global_reorder_threshold, 10) || 10); }
  if (data.shared_unit_costs !== undefined) {
    fields.push('shared_unit_costs = ?');
    params.push(typeof data.shared_unit_costs === 'string' ? data.shared_unit_costs : JSON.stringify(data.shared_unit_costs));
  }
  if (data.shopify_domain !== undefined) { fields.push('shopify_domain = ?'); params.push(data.shopify_domain); }
  if (data.shopify_client_id !== undefined) { fields.push('shopify_client_id = ?'); params.push(data.shopify_client_id); }
  if (data.shopify_client_secret !== undefined) { fields.push('shopify_client_secret = ?'); params.push(data.shopify_client_secret); }
  if (data.shopify_access_token !== undefined) { fields.push('shopify_access_token = ?'); params.push(data.shopify_access_token); }
  if (data.shopify_token_expires_at !== undefined) { fields.push('shopify_token_expires_at = ?'); params.push(data.shopify_token_expires_at); }
  if (data.shopify_webhook_secret !== undefined) { fields.push('shopify_webhook_secret = ?'); params.push(data.shopify_webhook_secret); }
  if (data.shopify_location_id !== undefined) { fields.push('shopify_location_id = ?'); params.push(data.shopify_location_id); }
  if (data.sync_enabled !== undefined) { fields.push('sync_enabled = ?'); params.push(data.sync_enabled ? 1 : 0); }
  if (data.sync_status !== undefined) { fields.push('sync_status = ?'); params.push(data.sync_status); }

  if (fields.length === 0) return;

  params.push(storeId);
  await query(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`, params);
};

module.exports = { getStore, getStorePrivate, updateStore };
