'use strict';
const { query, withTransaction } = require('../../config/db');

const getBalances = async ({
  search = '',
  low_stock = false,
  location_id,
  page = 1,
  limit = 20
} = {}) => {
  const offset = (page - 1) * limit;
  let where = 'pv.is_active = 1 AND p.is_active = 1';
  const params = [];

  if (search) {
    where += ' AND (p.name LIKE ? OR pv.name LIKE ? OR pv.sku LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (low_stock === 'true' || low_stock === true) {
    where += ' AND COALESCE(ib.available_qty, 0) <= pv.reorder_threshold';
  }
  if (location_id) {
    where += ' AND (ib.location_id = ? OR ib.location_id IS NULL)';
    params.push(location_id);
  }

  const countQuery = `
    SELECT COUNT(DISTINCT pv.id) as total
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
    WHERE ${where}
  `;
  const [countRes] = await query(countQuery, params);
  const total = countRes ? countRes.total : 0;

  const dataQuery = `
    SELECT 
      pv.id as variant_id,
      pv.product_id,
      p.name as product_name,
      pv.name as variant_name,
      pv.sku,
      pv.selling_price,
      pv.manufacturing_cost,
      pv.packaging_cost,
      pv.other_cost,
      pv.reorder_threshold,
      pv.shopify_variant_id,
      COALESCE(ib.available_qty, 0) as available_qty,
      COALESCE(ib.reserved_qty, 0) as reserved_qty,
      COALESCE(ib.incoming_qty, 0) as incoming_qty,
      ib.shopify_available,
      ib.last_synced_at,
      il.name as location_name,
      il.id as location_id,
      CASE WHEN COALESCE(ib.available_qty, 0) <= pv.reorder_threshold THEN 1 ELSE 0 END as is_low_stock
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
    LEFT JOIN inventory_locations il ON ib.location_id = il.id
    WHERE ${where}
    ORDER BY is_low_stock DESC, p.name ASC, pv.name ASC
    LIMIT ? OFFSET ?
  `;

  const items = await query(dataQuery, [...params, parseInt(limit, 10), parseInt(offset, 10)]);
  return { items, total };
};

const getMovements = async ({
  variant_id,
  movement_type,
  start_date,
  end_date,
  page = 1,
  limit = 20
} = {}) => {
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];

  if (variant_id) {
    where += ' AND im.variant_id = ?';
    params.push(variant_id);
  }
  if (movement_type) {
    where += ' AND im.movement_type = ?';
    params.push(movement_type);
  }
  if (start_date) {
    where += ' AND im.created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    where += ' AND im.created_at <= ?';
    params.push(end_date);
  }

  const [countRes] = await query(`SELECT COUNT(*) as total FROM inventory_movements im WHERE ${where}`, params);
  const total = countRes ? countRes.total : 0;

  const dataQuery = `
    SELECT 
      im.*,
      p.name as product_name,
      pv.name as variant_name,
      pv.sku,
      il.name as location_name,
      u.name as user_name
    FROM inventory_movements im
    JOIN product_variants pv ON im.variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN inventory_locations il ON im.location_id = il.id
    LEFT JOIN users u ON im.user_id = u.id
    WHERE ${where}
    ORDER BY im.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const movements = await query(dataQuery, [...params, parseInt(limit, 10), parseInt(offset, 10)]);
  return { movements, total };
};

const adjustStock = async ({ variant_id, location_id, new_qty, reason, user_id }) => {
  return await withTransaction(async (conn) => {
    let locId = location_id;
    if (!locId) {
      const [primaryLoc] = await conn.execute('SELECT id FROM inventory_locations WHERE is_primary = 1 LIMIT 1');
      locId = primaryLoc[0] ? primaryLoc[0].id : 1;
    }

    const [balRows] = await conn.execute(
      'SELECT available_qty FROM inventory_balances WHERE variant_id = ? AND location_id = ? FOR UPDATE',
      [variant_id, locId]
    );

    const qtyBefore = balRows[0] ? balRows[0].available_qty : 0;
    const targetQty = parseInt(new_qty, 10);
    const qtyChange = targetQty - qtyBefore;

    if (balRows.length > 0) {
      await conn.execute(
        'UPDATE inventory_balances SET available_qty = ?, updated_at = NOW() WHERE variant_id = ? AND location_id = ?',
        [targetQty, variant_id, locId]
      );
    } else {
      await conn.execute(
        'INSERT INTO inventory_balances (variant_id, location_id, available_qty) VALUES (?, ?, ?)',
        [variant_id, locId, targetQty]
      );
    }

    const [res] = await conn.execute(
      `INSERT INTO inventory_movements (
        variant_id, location_id, qty_change, qty_before, qty_after,
        movement_type, reference_type, source_system, user_id, notes
      ) VALUES (?, ?, ?, ?, ?, 'adjustment', 'adjustment', 'manual', ?, ?)`,
      [variant_id, locId, qtyChange, qtyBefore, targetQty, user_id || null, reason || 'Manual stock adjustment']
    );

    return { movement_id: res.insertId, qtyBefore, qtyAfter: targetQty, qtyChange };
  });
};

const getLocations = async () => {
  return query('SELECT * FROM inventory_locations WHERE is_active = 1 ORDER BY is_primary DESC, name ASC');
};

module.exports = {
  getBalances,
  getMovements,
  adjustStock,
  getLocations
};
