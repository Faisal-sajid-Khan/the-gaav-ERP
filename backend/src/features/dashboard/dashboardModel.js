'use strict';
const { query } = require('../../config/db');

const getKPIs = async ({ start_date, end_date, channel_id } = {}) => {
  let where = "o.status != 'cancelled'";
  const params = [];

  if (start_date) {
    where += ' AND o.order_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND o.order_date <= ?';
    params.push(end_date);
  }
  if (channel_id) {
    where += ' AND o.channel_id = ?';
    params.push(channel_id);
  }

  const [orderMetrics] = await query(
    `SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(o.gross_sales), 0) as total_gross_sales,
      COALESCE(SUM(o.net_sales), 0) as total_net_sales,
      COALESCE(SUM(o.discount_total), 0) as total_discounts,
      COALESCE(SUM(o.shipping_charged), 0) as total_shipping_charged,
      COALESCE(SUM(o.actual_shipping_expense), 0) as total_shipping_expense,
      COALESCE(SUM(o.tax_total), 0) as total_tax,
      COALESCE(SUM(COALESCE(o.net_revenue, o.net_sales)), 0) as total_net_revenue,
      COALESCE(SUM(o.channel_cost_total), 0) as total_channel_cost,
      COALESCE(SUM(o.cogs_total), 0) as total_cogs,
      COALESCE(SUM(COALESCE(o.bars_total, 0)), 0) as total_bars_sold,
      COALESCE(SUM(o.contribution), 0) as total_contribution,
      CASE 
        WHEN SUM(COALESCE(o.net_revenue, o.net_sales)) > 0 
          THEN (SUM(o.contribution) / SUM(COALESCE(o.net_revenue, o.net_sales))) * 100 
        ELSE 0 
      END as avg_contribution_margin_pct
     FROM orders o
     WHERE ${where}`,
    params
  );

  const [inventoryMetrics] = await query(
    `SELECT 
      COUNT(DISTINCT CASE WHEN COALESCE(ib.available_qty, 0) <= COALESCE(pv.reorder_threshold, 10) THEN pv.id END) as low_stock_count,
      COUNT(DISTINCT pv.id) as total_variants,
      COALESCE(SUM(ib.available_qty), 0) as total_units_in_stock
     FROM product_variants pv
     JOIN products p ON pv.product_id = p.id
     LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
     WHERE pv.is_active = 1 AND p.is_active = 1`
  );

  return {
    orders: orderMetrics || {
      total_orders: 0,
      total_gross_sales: 0,
      total_net_sales: 0,
      total_contribution: 0,
      avg_contribution_margin_pct: 0
    },
    inventory: inventoryMetrics || {
      low_stock_count: 0,
      total_variants: 0,
      total_units_in_stock: 0
    }
  };
};

const getSalesTrend = async ({ start_date, end_date, channel_id } = {}) => {
  let where = "o.status != 'cancelled'";
  const params = [];

  if (start_date) {
    where += ' AND o.order_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND o.order_date <= ?';
    params.push(end_date);
  }
  if (channel_id) {
    where += ' AND o.channel_id = ?';
    params.push(channel_id);
  }

  return query(
    `SELECT 
      o.order_date,
      COUNT(*) as order_count,
      COALESCE(SUM(o.gross_sales), 0) as gross_sales,
      COALESCE(SUM(COALESCE(o.net_revenue, o.net_sales)), 0) as net_sales,
      COALESCE(SUM(o.contribution), 0) as contribution,
      CASE 
        WHEN SUM(COALESCE(o.net_revenue, o.net_sales)) > 0 
          THEN (SUM(o.contribution) / SUM(COALESCE(o.net_revenue, o.net_sales))) * 100 
        ELSE 0 
      END as margin_pct
     FROM orders o
     WHERE ${where}
     GROUP BY o.order_date
     ORDER BY o.order_date ASC`,
    params
  );
};

/**
 * Formula 11: By Channel Aggregation
 * Sum bars, net_revenue, and contribution grouped by channel.
 * Weighted group margin = SUM(contribution) ÷ SUM(net_revenue).
 */
const getChannelBreakdown = async ({ start_date, end_date } = {}) => {
  let where = "o.status != 'cancelled'";
  const params = [];

  if (start_date) {
    where += ' AND o.order_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND o.order_date <= ?';
    params.push(end_date);
  }

  return query(
    `SELECT 
      sc.id as channel_id,
      sc.name as channel_name,
      sc.type as channel_type,
      COUNT(o.id) as order_count,
      COALESCE(SUM(COALESCE(o.bars_total, (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id), 0)), 0) as total_bars,
      COALESCE(SUM(COALESCE(o.net_revenue, o.net_sales)), 0) as net_sales,
      COALESCE(SUM(COALESCE(o.net_revenue, o.net_sales)), 0) as net_revenue,
      COALESCE(SUM(o.contribution), 0) as contribution,
      CASE 
        WHEN SUM(COALESCE(o.net_revenue, o.net_sales)) > 0 
          THEN (SUM(o.contribution) / SUM(COALESCE(o.net_revenue, o.net_sales))) * 100 
        ELSE 0 
      END as margin_pct
     FROM sales_channels sc
     LEFT JOIN orders o ON o.channel_id = sc.id AND ${where}
     WHERE sc.is_active = 1
     GROUP BY sc.id, sc.name, sc.type
     ORDER BY net_revenue DESC`,
    params
  );
};

/**
 * Formula 12: By Product Aggregation
 * Sum bars, net_revenue, and contribution grouped by product.
 */
const getTopProducts = async ({ limit = 10, start_date, end_date } = {}) => {
  let where = "o.status != 'cancelled'";
  const params = [];

  if (start_date) {
    where += ' AND o.order_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND o.order_date <= ?';
    params.push(end_date);
  }

  return query(
    `SELECT 
      p.id as product_id,
      p.name as product_name,
      pv.id as variant_id,
      pv.name as variant_name,
      pv.sku,
      COALESCE(SUM(COALESCE(oi.bars_sold, oi.quantity)), 0) as total_bars,
      COALESCE(SUM(oi.quantity), 0) as units_sold,
      COALESCE(SUM(COALESCE(oi.net_revenue, oi.net_product_sales)), 0) as total_net_sales,
      COALESCE(SUM(COALESCE(oi.net_revenue, oi.net_product_sales)), 0) as net_revenue,
      COALESCE(SUM(oi.line_contribution), 0) as total_contribution,
      CASE 
        WHEN SUM(COALESCE(oi.net_revenue, oi.net_product_sales)) > 0 
          THEN (SUM(oi.line_contribution) / SUM(COALESCE(oi.net_revenue, oi.net_product_sales))) * 100 
        ELSE 0 
      END as contribution_margin_pct
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN product_variants pv ON oi.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     WHERE ${where}
     GROUP BY p.id, p.name, pv.id, pv.name, pv.sku
     ORDER BY total_contribution DESC
     LIMIT ?`,
    [...params, parseInt(limit, 10)]
  );
};

/**
 * Formula 13: By Month Aggregation
 * Grouped by calendar month of order_date.
 */
const getMonthlyBreakdown = async ({ start_date, end_date } = {}) => {
  let where = "o.status != 'cancelled'";
  const params = [];

  if (start_date) {
    where += ' AND o.order_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND o.order_date <= ?';
    params.push(end_date);
  }

  return query(
    `SELECT 
      DATE_FORMAT(o.order_date, '%Y-%m') as month,
      COUNT(*) as order_count,
      COALESCE(SUM(COALESCE(o.bars_total, 0)), 0) as total_bars,
      COALESCE(SUM(COALESCE(o.net_revenue, o.net_sales)), 0) as net_revenue,
      COALESCE(SUM(o.contribution), 0) as contribution,
      CASE 
        WHEN SUM(COALESCE(o.net_revenue, o.net_sales)) > 0 
          THEN (SUM(o.contribution) / SUM(COALESCE(o.net_revenue, o.net_sales))) * 100 
        ELSE 0 
      END as margin_pct
     FROM orders o
     WHERE ${where}
     GROUP BY DATE_FORMAT(o.order_date, '%Y-%m')
     ORDER BY month ASC`,
    params
  );
};

const getRecentOrders = async ({ limit = 20 } = {}) => {
  return query(
    `SELECT 
      o.id,
      o.order_number,
      o.customer_name,
      o.order_date,
      o.status,
      COALESCE(o.bars_total, (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id), 0) as bars_sold,
      COALESCE(o.net_revenue, o.net_sales) as net_sales,
      COALESCE(o.tax_total, 0) as tax_amount,
      COALESCE(o.cogs_total, 0) as cogs,
      COALESCE(o.channel_cost_total, 0) as channel_fee,
      COALESCE(o.actual_shipping_expense, 0) as shipping_cost,
      o.contribution,
      o.contribution_margin_pct,
      sc.name as channel_name
     FROM orders o
     JOIN sales_channels sc ON o.channel_id = sc.id
     ORDER BY o.order_date DESC, o.id DESC
     LIMIT ?`,
    [parseInt(limit, 10)]
  );
};

module.exports = {
  getKPIs,
  getSalesTrend,
  getChannelBreakdown,
  getTopProducts,
  getMonthlyBreakdown,
  getRecentOrders
};
