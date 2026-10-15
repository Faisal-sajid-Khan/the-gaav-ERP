'use strict';
const model = require('./settingsModel');
const { success, error } = require('../../utils/responseHelper');
const { auditLog } = require('../../utils/auditLogger');

const getSettings = async (req, res, next) => {
  try {
    const store = await model.getStore(1);
    return success(res, store);
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  try {
    const {
      name,
      store_name,
      timezone,
      currency,
      currency_symbol,
      tax_rate,
      tax_registered,
      global_reorder_threshold,
      shared_unit_costs
    } = req.body;

    await model.updateStore(1, {
      name: name || store_name,
      timezone,
      currency,
      currency_symbol,
      tax_rate,
      tax_registered,
      global_reorder_threshold,
      shared_unit_costs
    });

    await auditLog({
      userId: req.user?.id,
      action: 'UPDATE_SETTINGS',
      entityType: 'store',
      entityId: 1,
      changes: { name: name || store_name, timezone, currency, tax_rate, tax_registered, global_reorder_threshold, shared_unit_costs },
      ipAddress: req.ip
    });
    return success(res, await model.getStore(1), 'Settings updated successfully');
  } catch (err) { next(err); }
};

const updateShopifyConfig = async (req, res, next) => {
  try {
    const { 
      shopify_domain, 
      shopify_client_id, 
      shopify_client_secret, 
      shopify_access_token, 
      shopify_webhook_secret, 
      shopify_location_id, 
      sync_enabled 
    } = req.body;

    await model.updateStore(1, {
      shopify_domain,
      shopify_client_id,
      shopify_client_secret,
      shopify_access_token,
      shopify_webhook_secret,
      shopify_location_id,
      sync_enabled,
      sync_status: shopify_domain && (shopify_access_token || (shopify_client_id && shopify_client_secret)) ? 'connected' : 'not_configured'
    });

    await auditLog({
      userId: req.user?.id,
      action: 'UPDATE_SHOPIFY_CONFIG',
      entityType: 'store',
      entityId: 1,
      changes: { shopify_domain, sync_enabled },
      ipAddress: req.ip
    });

    return success(res, await model.getStore(1), 'Shopify configuration saved successfully');
  } catch (err) { next(err); }
};

module.exports = { getSettings, updateSettings, updateShopifyConfig };
