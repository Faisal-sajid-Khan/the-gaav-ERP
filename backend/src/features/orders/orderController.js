'use strict';
const model = require('./orderModel');
const { calculateContribution } = require('../../utils/contributionCalculator');
const { query } = require('../../config/db');
const { success, error, paginated } = require('../../utils/responseHelper');
const { auditLog } = require('../../utils/auditLogger');
const shopifyService = require('../shopify/shopifyService');
const { autoSyncShopifyOrders } = require('../sync/syncQueue');

let lastFetchSync = 0;

const getAll = async (req, res, next) => {
  try {
    // If more than 30s have elapsed since last check, trigger silent background sync
    const now = Date.now();
    if (now - lastFetchSync > 30000) {
      lastFetchSync = now;
      autoSyncShopifyOrders().catch(err => console.warn('Background sync error on getAll:', err.message));
    }

    const { page = 1, limit = 20, status, channel_id, start_date, end_date, search } = req.query;
    const { orders, total } = await model.getAll({ page, limit, status, channel_id, start_date, end_date, search });
    return paginated(res, orders, total, page, limit);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const order = await model.getById(req.params.id);
    if (!order) return error(res, 'Order not found', 404);
    return success(res, order);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { channel_id, items, sync_to_shopify } = req.body;
    if (!channel_id) return error(res, 'Sales channel is required', 400);
    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, 'At least one order item is required', 400);
    }

    const orderId = await model.create(req.body, req.user?.id);
    await auditLog({
      userId: req.user?.id,
      action: 'ORDER_CREATED',
      entityType: 'order',
      entityId: orderId,
      ipAddress: req.ip
    });

    // Check if sales channel is external (non-Shopify) and push to Shopify if configured or requested
    let shopifySync = null;
    try {
      const channelRows = await query('SELECT type, name FROM sales_channels WHERE id = ?', [channel_id]);
      const storeRows = await query('SELECT shopify_domain, shopify_client_id, shopify_client_secret, shopify_access_token, sync_enabled FROM stores WHERE id = 1');
      const channel = channelRows[0];
      const store = storeRows[0];

      if (channel?.type !== 'shopify' && (sync_to_shopify || store?.sync_enabled === 1)) {
        const hasCredentials = store?.shopify_domain && (store?.shopify_access_token || (store?.shopify_client_id && store?.shopify_client_secret));
        if (hasCredentials) {
          shopifySync = await shopifyService.pushOrderToShopify(orderId);
        } else {
          shopifySync = { notice: 'Order saved locally. Connect Shopify in Shopify Integration tab to auto-sync to Shopify.' };
        }
      }
    } catch (syncErr) {
      console.warn(`Shopify sync notice for order #${orderId}:`, syncErr.message);
      shopifySync = { error: syncErr.message };
    }

    const createdOrder = await model.getById(orderId);
    return success(res, { ...createdOrder, shopifySync }, 'Order created successfully', 201);
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status, payment_status } = req.body;
    await model.updateStatus(req.params.id, status, payment_status, req.user?.id);
    await auditLog({
      userId: req.user?.id,
      action: 'ORDER_STATUS_UPDATED',
      entityType: 'order',
      entityId: req.params.id,
      changes: { status, payment_status },
      ipAddress: req.ip
    });
    return success(res, await model.getById(req.params.id), 'Order updated successfully');
  } catch (err) { next(err); }
};

const addRefund = async (req, res, next) => {
  try {
    const { refund_amount, restock, notes } = req.body;
    if (!refund_amount || parseFloat(refund_amount) <= 0) {
      return error(res, 'Valid refund amount is required', 400);
    }
    const refundId = await model.addRefund(req.params.id, req.body, req.user?.id);
    await auditLog({
      userId: req.user?.id,
      action: 'ORDER_REFUNDED',
      entityType: 'refund',
      entityId: refundId,
      changes: { refund_amount, restock },
      ipAddress: req.ip
    });
    return success(res, await model.getById(req.params.id), 'Refund processed successfully');
  } catch (err) { next(err); }
};

const previewCalculation = async (req, res, next) => {
  try {
    const { items = [], shipping_charged = 0, actual_shipping_expense = 0, costs = [], channel_id } = req.body;

    let orderCosts = [...costs];
    if (channel_id) {
      const rows = await query('SELECT * FROM sales_channels WHERE id = ?', [channel_id]);
      if (rows[0]) {
        const ch = rows[0];
        if (ch.fee_type === 'percentage' && ch.fee_value > 0) {
          const gross = items.reduce((acc, it) => acc + (parseFloat(it.quantity || 0) * parseFloat(it.selling_price || 0) - parseFloat(it.discount || 0)), 0);
          const feeAmt = (gross * parseFloat(ch.fee_value)) / 100;
          orderCosts.push({ cost_type: 'channel_fee', amount: feeAmt.toFixed(4), notes: `${ch.name} fee` });
        } else if (ch.fee_type === 'fixed' && ch.fee_value > 0) {
          orderCosts.push({ cost_type: 'channel_fee', amount: parseFloat(ch.fee_value).toFixed(4), notes: `${ch.name} fee` });
        }
      }
    }

    // Pull current variant costs for any item that didn't provide snapshots
    const itemsToCalculate = [];
    for (const item of items) {
      let mfg = item.manufacturing_cost_snapshot;
      let pkg = item.packaging_cost_snapshot;
      let oth = item.other_cost_snapshot;
      let price = item.selling_price;

      if (item.variant_id && (mfg === undefined || pkg === undefined || oth === undefined || price === undefined)) {
        const rows = await query('SELECT * FROM product_variants WHERE id = ?', [item.variant_id]);
        if (rows[0]) {
          const v = rows[0];
          mfg = mfg ?? v.manufacturing_cost;
          pkg = pkg ?? v.packaging_cost;
          oth = oth ?? v.other_cost;
          price = price ?? v.selling_price;
        }
      }

      itemsToCalculate.push({
        ...item,
        selling_price: price || 0,
        manufacturing_cost_snapshot: mfg || 0,
        packaging_cost_snapshot: pkg || 0,
        other_cost_snapshot: oth || 0,
      });
    }

    const calc = calculateContribution({
      items: itemsToCalculate,
      shippingCharged: shipping_charged,
      actualShippingExpense: actual_shipping_expense,
      orderCosts
    });

    return success(res, calc, 'Calculation preview');
  } catch (err) { next(err); }
};

const recalculate = async (req, res, next) => {
  try {
    const updated = await model.recalculateOrder(req.params.id);
    return success(res, updated, 'Order economics recalculated successfully');
  } catch (err) { next(err); }
};

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  addRefund,
  previewCalculation,
  recalculate
};
