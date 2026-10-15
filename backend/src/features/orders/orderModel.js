'use strict';
const { query, getConnection, withTransaction } = require('../../config/db');
const { calculateContribution } = require('../../utils/contributionCalculator');

const getAll = async ({
  page = 1,
  limit = 20,
  status,
  channel_id,
  start_date,
  end_date,
  search
} = {}) => {
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];

  if (status) {
    where += ' AND o.status = ?';
    params.push(status);
  }
  if (channel_id) {
    where += ' AND o.channel_id = ?';
    params.push(channel_id);
  }
  if (start_date) {
    where += ' AND o.order_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND o.order_date <= ?';
    params.push(end_date);
  }
  if (search) {
    where += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.shopify_order_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [countRes] = await query(
    `SELECT COUNT(*) as total FROM orders o WHERE ${where}`,
    params
  );
  const total = countRes ? countRes.total : 0;

  const orders = await query(
    `SELECT 
      o.*, 
      sc.name as channel_name, 
      sc.type as channel_type,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
     FROM orders o
     JOIN sales_channels sc ON o.channel_id = sc.id
     WHERE ${where}
     ORDER BY o.order_date DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  return { orders, total };
};

const getById = async (id) => {
  const rows = await query(
    `SELECT o.*, sc.name as channel_name, sc.type as channel_type, u.name as created_by_name
     FROM orders o
     JOIN sales_channels sc ON o.channel_id = sc.id
     LEFT JOIN users u ON u.id = o.created_by
     WHERE o.id = ?`,
    [id]
  );
  if (!rows[0]) return null;

  const items = await query(
    `SELECT 
      oi.*,
      pv.name as variant_name,
      pv.sku as variant_sku,
      p.name as product_name
     FROM order_items oi
     JOIN product_variants pv ON oi.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     WHERE oi.order_id = ?`,
    [id]
  );

  const costs = await query('SELECT * FROM order_costs WHERE order_id = ?', [id]);
  const refunds = await query('SELECT * FROM refunds WHERE order_id = ?', [id]);

  return { ...rows[0], items, costs, refunds };
};

const create = async (orderData, userId) => {
  return await withTransaction(async (conn) => {
    // 1. Fetch store tax and shared cost master data
    const [storeRows] = await conn.execute(
      'SELECT tax_rate, tax_registered, shared_unit_costs FROM stores WHERE id = 1'
    );
    const store = storeRows[0] || {};
    let parsedSharedCosts = [];
    try {
      parsedSharedCosts = typeof store.shared_unit_costs === 'string'
        ? JSON.parse(store.shared_unit_costs)
        : (store.shared_unit_costs || []);
    } catch {
      parsedSharedCosts = [];
    }

    // 2. Fetch channel details for fees & economics
    const [channelRows] = await conn.execute(
      'SELECT * FROM sales_channels WHERE id = ? FOR UPDATE',
      [orderData.channel_id]
    );
    if (!channelRows[0]) {
      throw new Error('Sales channel not found');
    }
    const channel = channelRows[0];

    // 3. Fetch primary location
    const [locRows] = await conn.execute(
      'SELECT id FROM inventory_locations WHERE is_primary = 1 LIMIT 1'
    );
    const locationId = orderData.location_id || (locRows[0] ? locRows[0].id : 1);

    // 4. Process items and pull snapshots
    const itemsWithSnapshots = [];
    for (const item of orderData.items) {
      const [vRows] = await conn.execute(
        `SELECT pv.*, p.name as product_name, COALESCE(pv.units_per_sale, p.units_per_sale, 1) as units_per_sale
         FROM product_variants pv 
         JOIN products p ON pv.product_id = p.id 
         WHERE pv.id = ? FOR UPDATE`,
        [item.variant_id]
      );
      if (!vRows[0]) {
        throw new Error(`Product variant ID ${item.variant_id} not found`);
      }
      const v = vRows[0];

      const qty = parseInt(item.quantity, 10);
      if (qty <= 0) {
        throw new Error(`Quantity for variant ${v.name} must be greater than 0`);
      }

      const unitsPerSale = Math.max(1, parseInt(item.units_per_sale || v.units_per_sale, 10) || 1);
      const bars = item.bars !== undefined ? parseFloat(item.bars) : (qty * unitsPerSale);

      itemsWithSnapshots.push({
        variant_id: item.variant_id,
        quantity: qty,
        bars,
        product_units_per_sale: unitsPerSale,
        channel_units_per_sale: channel.units_per_sale || 1,
        selling_price: item.selling_price !== undefined ? parseFloat(item.selling_price) : parseFloat(v.selling_price),
        discount: parseFloat(item.discount || 0),
        manufacturing_cost_snapshot: parseFloat(v.manufacturing_cost),
        packaging_cost_snapshot: parseFloat(v.packaging_cost),
        other_cost_snapshot: parseFloat(v.other_cost),
        shopify_line_item_id: item.shopify_line_item_id || null,
      });
    }

    // 5. Calculate channel fees if legacy fee_type is set
    const orderCosts = [...(orderData.costs || [])];
    if (channel.fee_type === 'percentage' && channel.fee_value > 0) {
      const gross = itemsWithSnapshots.reduce((acc, it) => acc + (it.quantity * it.selling_price - it.discount), 0);
      const feeAmt = (gross * parseFloat(channel.fee_value)) / 100;
      orderCosts.push({
        cost_type: 'channel_fee',
        amount: feeAmt.toFixed(4),
        notes: `${channel.name} legacy fee (${channel.fee_value}%)`
      });
    } else if (channel.fee_type === 'fixed' && channel.fee_value > 0) {
      orderCosts.push({
        cost_type: 'channel_fee',
        amount: parseFloat(channel.fee_value).toFixed(4),
        notes: `${channel.name} legacy fixed fee`
      });
    }

    // 6. Calculate Phase 1 MVP unit-economics
    const calc = calculateContribution({
      items: itemsWithSnapshots,
      channel,
      taxRate: store.tax_rate,
      taxRegistered: store.tax_registered,
      sharedUnitCosts: parsedSharedCosts,
      shippingCharged: orderData.shipping_charged || 0,
      actualShippingExpense: orderData.actual_shipping_expense || 0,
      orderCosts,
      orderDiscount: orderData.order_discount || 0
    });

    // 7. Generate order number if not provided
    const orderNumber = orderData.order_number || `ORD-${Date.now().toString().slice(-8)}`;

    const shippingAddressStr = orderData.shipping_address
      ? (typeof orderData.shipping_address === 'object' ? JSON.stringify(orderData.shipping_address) : orderData.shipping_address)
      : null;

    // 8. Insert order with unit-economics columns
    const [orderResult] = await conn.execute(
      `INSERT INTO orders (
        store_id, channel_id, order_number, shopify_order_id, shopify_order_number,
        customer_name, customer_contact, customer_email, customer_phone, shipping_address,
        order_date, status, payment_status,
        shipping_charged, actual_shipping_expense, discount_total,
        gross_sales, net_sales, tax_total, net_revenue, channel_cost_total, cogs_total, bars_total,
        contribution, contribution_margin_pct,
        notes, shopify_sync_status, created_by
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderData.channel_id,
        orderNumber,
        orderData.shopify_order_id || null,
        orderData.shopify_order_number || null,
        orderData.customer_name || 'Direct Customer',
        orderData.customer_contact || null,
        orderData.customer_email || null,
        orderData.customer_phone || null,
        shippingAddressStr,
        orderData.order_date || new Date().toISOString().slice(0, 10),
        orderData.status || 'confirmed',
        orderData.payment_status || 'pending',
        orderData.shipping_charged || 0,
        orderData.actual_shipping_expense || 0,
        calc.discountTotal,
        calc.grossSales,
        calc.netSales,
        calc.taxTotal,
        calc.netRevenue,
        calc.channelCostTotal,
        calc.cogsTotal,
        calc.barsTotal,
        calc.contribution,
        calc.contributionMarginPct,
        orderData.notes || null,
        orderData.shopify_sync_status || 'not_applicable',
        userId || null
      ]
    );

    const orderId = orderResult.insertId;

    // 9. Insert order items with landed cost, tax, and COGS snapshots
    for (const item of calc.calculatedItems) {
      await conn.execute(
        `INSERT INTO order_items (
          order_id, variant_id, quantity, bars_sold, sale_count, selling_price, discount,
          net_product_sales, landed_cost_snapshot, shared_cost_snapshot,
          manufacturing_cost_snapshot, packaging_cost_snapshot, other_cost_snapshot,
          tax_amount, net_revenue, channel_cost, cogs, line_contribution, shopify_line_item_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.variant_id,
          item.quantity,
          item.bars_sold || item.quantity,
          item.sale_count || item.quantity,
          item.selling_price,
          item.discount,
          item.net_product_sales,
          item.landed_cost_snapshot,
          item.shared_cost_snapshot,
          item.manufacturing_cost_snapshot,
          item.packaging_cost_snapshot,
          item.other_cost_snapshot,
          item.tax_amount,
          item.net_revenue,
          item.channel_cost,
          item.cogs,
          item.line_contribution,
          item.shopify_line_item_id || null
        ]
      );

      // Deduct inventory balance
      const [currentBal] = await conn.execute(
        'SELECT available_qty FROM inventory_balances WHERE variant_id = ? AND location_id = ? FOR UPDATE',
        [item.variant_id, locationId]
      );

      const qtyBefore = currentBal[0] ? currentBal[0].available_qty : 0;
      const qtyAfter = qtyBefore - item.quantity;

      if (currentBal.length > 0) {
        await conn.execute(
          'UPDATE inventory_balances SET available_qty = ? WHERE variant_id = ? AND location_id = ?',
          [qtyAfter, item.variant_id, locationId]
        );
      } else {
        await conn.execute(
          'INSERT INTO inventory_balances (variant_id, location_id, available_qty) VALUES (?, ?, ?)',
          [item.variant_id, locationId, qtyAfter]
        );
      }

      // Record movement ledger
      await conn.execute(
        `INSERT INTO inventory_movements (
          variant_id, location_id, qty_change, qty_before, qty_after,
          movement_type, reference_type, reference_id, source_system,
          shopify_reference, sync_status, user_id, notes
        ) VALUES (?, ?, ?, ?, ?, 'sale', 'order', ?, ?, ?, ?, ?, ?)`,
        [
          item.variant_id,
          locationId,
          -item.quantity,
          qtyBefore,
          qtyAfter,
          orderId,
          channel.type === 'shopify' ? 'shopify' : 'manual',
          orderData.shopify_order_id || null,
          channel.type === 'shopify' ? 'synced' : 'na',
          userId || null,
          `Order ${orderNumber}`
        ]
      );
    }

    // 9. Insert order costs
    for (const c of orderCosts) {
      await conn.execute(
        'INSERT INTO order_costs (order_id, cost_type, amount, notes) VALUES (?, ?, ?, ?)',
        [orderId, c.cost_type, parseFloat(c.amount) || 0, c.notes || null]
      );
    }

    return orderId;
  });
};

const updateStatus = async (id, status, paymentStatus, userId) => {
  return await withTransaction(async (conn) => {
    const [orderRows] = await conn.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!orderRows[0]) throw new Error('Order not found');
    const oldOrder = orderRows[0];

    const fields = [];
    const params = [];
    if (status) { fields.push('status = ?'); params.push(status); }
    if (paymentStatus) { fields.push('payment_status = ?'); params.push(paymentStatus); }
    params.push(id);

    if (fields.length > 0) {
      await conn.execute(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    // If order was cancelled and wasn't already cancelled, restock items!
    if (status === 'cancelled' && oldOrder.status !== 'cancelled') {
      const [items] = await conn.execute('SELECT * FROM order_items WHERE order_id = ?', [id]);
      const [loc] = await conn.execute('SELECT id FROM inventory_locations WHERE is_primary = 1 LIMIT 1');
      const locationId = loc[0] ? loc[0].id : 1;

      for (const item of items) {
        const [bal] = await conn.execute(
          'SELECT available_qty FROM inventory_balances WHERE variant_id = ? AND location_id = ? FOR UPDATE',
          [item.variant_id, locationId]
        );
        const qtyBefore = bal[0] ? bal[0].available_qty : 0;
        const qtyAfter = qtyBefore + item.quantity;

        await conn.execute(
          'UPDATE inventory_balances SET available_qty = ? WHERE variant_id = ? AND location_id = ?',
          [qtyAfter, item.variant_id, locationId]
        );

        await conn.execute(
          `INSERT INTO inventory_movements (
            variant_id, location_id, qty_change, qty_before, qty_after,
            movement_type, reference_type, reference_id, source_system, notes, user_id
          ) VALUES (?, ?, ?, ?, ?, 'return', 'order', ?, 'system', 'Order cancelled restock', ?)`,
          [item.variant_id, locationId, item.quantity, qtyBefore, qtyAfter, id, userId || null]
        );
      }
    }
  });
};

const addRefund = async (orderId, { refund_amount, restock, notes, shopify_refund_id }, userId) => {
  return await withTransaction(async (conn) => {
    const [orders] = await conn.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!orders[0]) throw new Error('Order not found');

    const [res] = await conn.execute(
      `INSERT INTO refunds (order_id, shopify_refund_id, refund_amount, restock, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, shopify_refund_id || null, parseFloat(refund_amount) || 0, restock ? 1 : 0, notes || null, userId || null]
    );

    if (restock) {
      const [items] = await conn.execute('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
      const [loc] = await conn.execute('SELECT id FROM inventory_locations WHERE is_primary = 1 LIMIT 1');
      const locationId = loc[0] ? loc[0].id : 1;

      for (const item of items) {
        const [bal] = await conn.execute(
          'SELECT available_qty FROM inventory_balances WHERE variant_id = ? AND location_id = ? FOR UPDATE',
          [item.variant_id, locationId]
        );
        const qtyBefore = bal[0] ? bal[0].available_qty : 0;
        const qtyAfter = qtyBefore + item.quantity;

        await conn.execute(
          'UPDATE inventory_balances SET available_qty = ? WHERE variant_id = ? AND location_id = ?',
          [qtyAfter, item.variant_id, locationId]
        );

        await conn.execute(
          `INSERT INTO inventory_movements (
            variant_id, location_id, qty_change, qty_before, qty_after,
            movement_type, reference_type, reference_id, source_system, notes, user_id
          ) VALUES (?, ?, ?, ?, ?, 'return', 'refund', ?, 'manual', 'Refund restock', ?)`,
          [item.variant_id, locationId, item.quantity, qtyBefore, qtyAfter, res.insertId, userId || null]
        );
      }
    }

    return res.insertId;
  });
};

const recalculateOrder = async (orderId) => {
  return await withTransaction(async (conn) => {
    // 1. Fetch store tax and shared cost master data
    const [storeRows] = await conn.execute(
      'SELECT tax_rate, tax_registered, shared_unit_costs FROM stores WHERE id = 1'
    );
    const store = storeRows[0] || {};
    let parsedSharedCosts = [];
    try {
      parsedSharedCosts = typeof store.shared_unit_costs === 'string'
        ? JSON.parse(store.shared_unit_costs)
        : (store.shared_unit_costs || []);
    } catch {
      parsedSharedCosts = [];
    }

    // 2. Fetch order
    const [orderRows] = await conn.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!orderRows[0]) throw new Error('Order not found');
    const order = orderRows[0];

    // 3. Fetch channel details
    const [channelRows] = await conn.execute('SELECT * FROM sales_channels WHERE id = ?', [order.channel_id]);
    if (!channelRows[0]) throw new Error('Sales channel not found');
    const channel = channelRows[0];

    // 4. Fetch existing items
    const [itemRows] = await conn.execute('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    if (!itemRows.length) return order;

    // 5. Build items with updated variant costs
    const itemsWithSnapshots = [];
    for (const item of itemRows) {
      const [vRows] = await conn.execute(
        `SELECT pv.*, p.name as product_name, COALESCE(pv.units_per_sale, p.units_per_sale, 1) as units_per_sale
         FROM product_variants pv 
         JOIN products p ON pv.product_id = p.id 
         WHERE pv.id = ?`,
        [item.variant_id]
      );
      const v = vRows[0] || {};
      const unitsPerSale = Math.max(1, parseInt(v.units_per_sale, 10) || 1);
      const qty = parseInt(item.quantity, 10) || 1;
      const bars = qty * unitsPerSale;

      itemsWithSnapshots.push({
        id: item.id,
        variant_id: item.variant_id,
        quantity: qty,
        bars,
        product_units_per_sale: unitsPerSale,
        channel_units_per_sale: channel.units_per_sale || 1,
        selling_price: parseFloat(item.selling_price || v.selling_price || 0),
        discount: parseFloat(item.discount || 0),
        manufacturing_cost_snapshot: parseFloat(v.manufacturing_cost || 0),
        packaging_cost_snapshot: parseFloat(v.packaging_cost || 0),
        other_cost_snapshot: parseFloat(v.other_cost || 0),
        shopify_line_item_id: item.shopify_line_item_id || null,
      });
    }

    // 6. Fetch order costs if any
    const [orderCosts] = await conn.execute('SELECT * FROM order_costs WHERE order_id = ?', [orderId]);

    // 7. Calculate Phase 1 MVP unit-economics
    const calc = calculateContribution({
      items: itemsWithSnapshots,
      channel,
      taxRate: store.tax_rate,
      taxRegistered: store.tax_registered,
      sharedUnitCosts: parsedSharedCosts,
      shippingCharged: order.shipping_charged || 0,
      actualShippingExpense: order.actual_shipping_expense || 0,
      orderCosts,
      orderDiscount: 0
    });

    // 8. Update order_items
    for (const line of calc.calculatedItems) {
      await conn.execute(
        `UPDATE order_items SET
          manufacturing_cost_snapshot = ?,
          packaging_cost_snapshot = ?,
          other_cost_snapshot = ?,
          landed_cost_snapshot = ?,
          shared_cost_snapshot = ?,
          bars_sold = ?,
          sale_count = ?,
          tax_amount = ?,
          net_revenue = ?,
          channel_cost = ?,
          cogs = ?,
          line_contribution = ?
         WHERE id = ?`,
        [
          line.manufacturing_cost_snapshot,
          line.packaging_cost_snapshot,
          line.other_cost_snapshot,
          line.landed_cost_snapshot,
          line.shared_cost_snapshot,
          line.bars_sold,
          line.sale_count,
          line.tax_amount,
          line.net_revenue,
          line.channel_cost,
          line.cogs,
          line.line_contribution,
          line.id
        ]
      );
    }

    // 9. Update orders
    await conn.execute(
      `UPDATE orders SET
        tax_total = ?,
        net_revenue = ?,
        net_sales = ?,
        channel_cost_total = ?,
        cogs_total = ?,
        bars_total = ?,
        contribution = ?,
        contribution_margin_pct = ?
       WHERE id = ?`,
      [
        calc.taxTotal,
        calc.netRevenue,
        calc.netSales,
        calc.channelCostTotal,
        calc.cogsTotal,
        calc.barsTotal,
        calc.contribution,
        calc.contributionMarginPct,
        orderId
      ]
    );

    const [updated] = await conn.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
    return updated[0];
  });
};

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  addRefund,
  recalculateOrder
};
