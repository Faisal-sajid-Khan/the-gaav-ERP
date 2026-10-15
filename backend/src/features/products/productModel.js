'use strict';
const { query, getConnection } = require('../../config/db');

const getAll = async ({ page = 1, limit = 20, search = '', is_active } = {}) => {
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];
  if (search) {
    where += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (is_active !== undefined && is_active !== '') {
    where += ' AND p.is_active = ?';
    params.push(is_active);
  }

  const countRows = await query(`SELECT COUNT(*) as total FROM products p WHERE ${where}`, params);
  const total = countRows[0].total;

  const products = await query(
    `SELECT p.*, 
      (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as variant_count,
      (SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as min_price,
      (SELECT MAX(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) as max_price,
      (SELECT COALESCE(SUM(ib.available_qty), 0) 
       FROM product_variants pv 
       JOIN inventory_balances ib ON ib.variant_id = pv.id 
       WHERE pv.product_id = p.id) as total_stock
     FROM products p 
     WHERE ${where} 
     ORDER BY p.created_at DESC 
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );
  return { products, total };
};

const getById = async (id) => {
  const rows = await query('SELECT * FROM products WHERE id = ?', [id]);
  if (!rows[0]) return null;
  const variants = await query(
    `SELECT pv.*, 
      COALESCE((SELECT SUM(ib.available_qty) FROM inventory_balances ib WHERE ib.variant_id = pv.id), 0) as available_qty
     FROM product_variants pv 
     WHERE pv.product_id = ? 
     ORDER BY pv.id`,
    [id]
  );
  return { ...rows[0], variants };
};

const create = async ({ name, sku, description, shopify_product_id }) => {
  const result = await query(
    'INSERT INTO products (store_id, name, sku, description, shopify_product_id) VALUES (1, ?, ?, ?, ?)',
    [name, sku || null, description || null, shopify_product_id || null]
  );
  return result.insertId;
};

const update = async (id, { name, sku, description, shopify_product_id, is_active }) => {
  await query(
    'UPDATE products SET name = ?, sku = ?, description = ?, shopify_product_id = ?, is_active = ? WHERE id = ?',
    [name, sku || null, description || null, shopify_product_id || null, is_active !== undefined ? is_active : 1, id]
  );
};

const createVariant = async (productId, data, userId, conn = null) => {
  const db = conn || { execute: async (sql, p) => [await query(sql, p)] };

  const [result] = await (conn ? conn.execute(
    `INSERT INTO product_variants (product_id, name, sku, shopify_variant_id, shopify_inventory_item_id,
      selling_price, manufacturing_cost, packaging_cost, other_cost, reorder_threshold, units_per_sale)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      data.name || 'Default',
      data.sku || null,
      data.shopify_variant_id || null,
      data.shopify_inventory_item_id || null,
      data.selling_price || 0,
      data.manufacturing_cost || 0,
      data.packaging_cost || 0,
      data.other_cost || 0,
      data.reorder_threshold || 10,
      parseInt(data.units_per_sale, 10) || 1
    ]
  ) : query(
    `INSERT INTO product_variants (product_id, name, sku, shopify_variant_id, shopify_inventory_item_id,
      selling_price, manufacturing_cost, packaging_cost, other_cost, reorder_threshold, units_per_sale)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      data.name || 'Default',
      data.sku || null,
      data.shopify_variant_id || null,
      data.shopify_inventory_item_id || null,
      data.selling_price || 0,
      data.manufacturing_cost || 0,
      data.packaging_cost || 0,
      data.other_cost || 0,
      data.reorder_threshold || 10,
      parseInt(data.units_per_sale, 10) || 1
    ]
  ).then(r => [r]));

  const variantId = result.insertId;

  await query(
    `INSERT INTO product_cost_history (variant_id, manufacturing_cost, packaging_cost, other_cost, effective_from, created_by)
     VALUES (?, ?, ?, ?, NOW(), ?)`,
    [variantId, data.manufacturing_cost || 0, data.packaging_cost || 0, data.other_cost || 0, userId || null]
  );

  const locs = await query('SELECT id FROM inventory_locations WHERE is_primary = 1 LIMIT 1');
  if (locs.length > 0) {
    const locId = locs[0].id;
    const initialQty = parseInt(data.initial_qty, 10) || 0;
    await query(
      'INSERT IGNORE INTO inventory_balances (variant_id, location_id, available_qty) VALUES (?, ?, ?)',
      [variantId, locId, initialQty]
    );
    if (initialQty > 0) {
      await query(
        `INSERT INTO inventory_movements (variant_id, location_id, qty_change, qty_before, qty_after, movement_type, source_system, notes, user_id)
         VALUES (?, ?, ?, 0, ?, 'initial', 'manual', 'Initial stock', ?)`,
        [variantId, locId, initialQty, initialQty, userId || null]
      );
    }
  }

  return variantId;
};

const updateVariant = async (id, data, userId) => {
  const old = await query('SELECT * FROM product_variants WHERE id = ?', [id]);
  if (!old[0]) return;
  const v = old[0];
  const costsChanged =
    parseFloat(data.manufacturing_cost ?? v.manufacturing_cost) !== parseFloat(v.manufacturing_cost) ||
    parseFloat(data.packaging_cost ?? v.packaging_cost) !== parseFloat(v.packaging_cost) ||
    parseFloat(data.other_cost ?? v.other_cost) !== parseFloat(v.other_cost);

  await query(
    `UPDATE product_variants SET name=?, sku=?, selling_price=?, manufacturing_cost=?, packaging_cost=?, other_cost=?, reorder_threshold=?, units_per_sale=?, is_active=? WHERE id=?`,
    [
      data.name || v.name,
      data.sku !== undefined ? data.sku : v.sku,
      data.selling_price !== undefined ? data.selling_price : v.selling_price,
      data.manufacturing_cost !== undefined ? data.manufacturing_cost : v.manufacturing_cost,
      data.packaging_cost !== undefined ? data.packaging_cost : v.packaging_cost,
      data.other_cost !== undefined ? data.other_cost : v.other_cost,
      data.reorder_threshold !== undefined ? data.reorder_threshold : v.reorder_threshold,
      data.units_per_sale !== undefined ? (parseInt(data.units_per_sale, 10) || 1) : (v.units_per_sale || 1),
      data.is_active !== undefined ? data.is_active : v.is_active,
      id
    ]
  );

  if (costsChanged) {
    await query(
      `INSERT INTO product_cost_history (variant_id, manufacturing_cost, packaging_cost, other_cost, effective_from, created_by)
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [
        id,
        data.manufacturing_cost !== undefined ? data.manufacturing_cost : v.manufacturing_cost,
        data.packaging_cost !== undefined ? data.packaging_cost : v.packaging_cost,
        data.other_cost !== undefined ? data.other_cost : v.other_cost,
        userId || null
      ]
    );
  }
};

const getVariantById = async (id) => {
  const rows = await query(
    `SELECT pv.*, p.name as product_name,
      COALESCE((SELECT SUM(ib.available_qty) FROM inventory_balances ib WHERE ib.variant_id = pv.id), 0) as available_qty
     FROM product_variants pv 
     JOIN products p ON pv.product_id = p.id 
     WHERE pv.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const getCostHistory = async (variantId) => {
  return query(
    `SELECT pch.*, u.name as created_by_name 
     FROM product_cost_history pch 
     LEFT JOIN users u ON u.id = pch.created_by 
     WHERE pch.variant_id = ? 
     ORDER BY pch.effective_from DESC`,
    [variantId]
  );
};

const checkDuplicateSKU = async (sku, excludeId = null) => {
  if (!sku) return false;
  const sql = excludeId ? 'SELECT id FROM products WHERE sku = ? AND id != ?' : 'SELECT id FROM products WHERE sku = ?';
  const params = excludeId ? [sku, excludeId] : [sku];
  const rows = await query(sql, params);
  return rows.length > 0;
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  createVariant,
  updateVariant,
  getVariantById,
  getCostHistory,
  checkDuplicateSKU
};
