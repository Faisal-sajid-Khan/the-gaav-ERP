'use strict';
const cron = require('node-cron');
const { query } = require('../../config/db');
const shopifyService = require('../shopify/shopifyService');
const webhookHandler = require('../shopify/shopifyWebhookHandler');
const notificationModel = require('../notifications/notificationModel');

let cronTask = null;
let pollerInterval = null;
let isSyncingOrders = false;

async function autoSyncShopifyOrders() {
  if (isSyncingOrders) return;
  isSyncingOrders = true;
  try {
    const stores = await query(
      'SELECT shopify_domain, shopify_client_id, shopify_client_secret, shopify_access_token, sync_enabled FROM stores WHERE id = 1'
    );
    const store = stores[0];
    if (!store || !store.shopify_domain) return;
    if (store.sync_enabled === 0) return;

    const hasCreds = store.shopify_access_token || (store.shopify_client_id && store.shopify_client_secret);
    if (!hasCreds) return;

    const orders = await shopifyService.getOrders({ limit: 25, status: 'any' });
    if (!Array.isArray(orders) || orders.length === 0) return;

    for (const ord of orders) {
      try {
        const ordIdStr = String(ord.id);
        const existing = await query('SELECT id FROM orders WHERE shopify_order_id = ?', [ordIdStr]);
        if (existing.length === 0) {
          const res = await webhookHandler.processOrderCreate(ord);
          if (res?.success) {
            console.log(`✨ [AUTO-SYNC] Imported new order ${ord.name || ordIdStr} into ERP (Order #${res.orderId}) & decremented inventory.`);
          }
        }
      } catch (ordErr) {
        console.error(`⚠️ [AUTO-SYNC] Error importing order ${ord.name || ord.id}:`, ordErr.message);
      }
    }
  } catch (err) {
    if (!err.message?.includes('socket') && !err.message?.includes('ETIMEDOUT') && !err.message?.includes('ECONNRESET')) {
      console.warn('⚠️ [AUTO-SYNC] Notice:', err.message);
    }
  } finally {
    isSyncingOrders = false;
  }
}

async function processPendingJobs() {
  try {
    const jobs = await query(
      `SELECT * FROM sync_jobs 
       WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW()) 
       ORDER BY created_at ASC LIMIT 10`
    );

    for (const job of jobs) {
      await query('UPDATE sync_jobs SET status = \'running\', attempts = attempts + 1 WHERE id = ?', [job.id]);
      try {
        const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;

        if (job.job_type === 'order_create' && payload) {
          await webhookHandler.processOrderCreate(payload);
        } else if (job.job_type === 'inventory_sync' && payload) {
          await shopifyService.setInventoryLevel({
            inventory_item_id: payload.inventory_item_id,
            location_id: payload.location_id,
            available: payload.available
          });
        } else if (job.job_type === 'push_order') {
          const orderId = job.reference_id || (payload ? payload.order_id : null);
          if (orderId) {
            await shopifyService.pushOrderToShopify(orderId);
          }
        }

        await query('UPDATE sync_jobs SET status = \'done\', updated_at = NOW() WHERE id = ?', [job.id]);
      } catch (err) {
        const nextAttempts = job.attempts + 1;
        if (nextAttempts >= job.max_attempts) {
          await query(
            'UPDATE sync_jobs SET status = \'failed\', last_error = ?, updated_at = NOW() WHERE id = ?',
            [err.message, job.id]
          );
          await notificationModel.create({
            title: `Sync Job #${job.id} Failed`,
            message: `Job ${job.job_type} exceeded max attempts: ${err.message}`,
            type: 'error'
          });
        } else {
          // Exponential backoff: 2^attempts * 60 seconds
          const delayMinutes = Math.pow(2, nextAttempts);
          await query(
            `UPDATE sync_jobs 
             SET status = 'pending', last_error = ?, next_retry_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW() 
             WHERE id = ?`,
            [err.message, delayMinutes, job.id]
          );
        }
      }
    }
  } catch (err) {
    console.error('Queue processing error:', err.message);
  }
}

function initSyncCron() {
  if (cronTask) return;

  // 1. Retry queue every 2 minutes
  cronTask = cron.schedule('*/2 * * * *', () => {
    processPendingJobs();
  });

  // 2. Automated real-time order poller every 30 seconds
  // Listens and automatically pulls orders from ecommerce website & Shopify admin
  pollerInterval = setInterval(() => {
    autoSyncShopifyOrders();
  }, 30000);

  // Run immediate sync 3 seconds after server boot
  setTimeout(() => {
    autoSyncShopifyOrders();
  }, 3000);

  console.log('⏱️  Automated Shopify 30s live order poller and retry cron initialized');
}

module.exports = { initSyncCron, processPendingJobs, autoSyncShopifyOrders };
