'use strict';
const { query } = require('../../config/db');

const getAll = async (activeOnly = false) => {
  const where = activeOnly ? 'WHERE is_active = 1' : '';
  return query(`SELECT * FROM sales_channels ${where} ORDER BY name`);
};

const getById = async (id) => {
  const rows = await query('SELECT * FROM sales_channels WHERE id = ?', [id]);
  return rows[0] || null;
};

const create = async (data) => {
  const result = await query(
    `INSERT INTO sales_channels (
      store_id, name, type, units_per_sale, price_includes_tax,
      commission_pct, gateway_pct, shipping_per_sale, other_variable_cost,
      fee_type, fee_value, config
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.type || 'other',
      parseInt(data.units_per_sale, 10) || 1,
      data.price_includes_tax !== undefined ? (data.price_includes_tax ? 1 : 0) : 1,
      parseFloat(data.commission_pct) || 0,
      parseFloat(data.gateway_pct) || 0,
      parseFloat(data.shipping_per_sale) || 0,
      parseFloat(data.other_variable_cost) || 0,
      data.fee_type || 'none',
      data.fee_value || 0,
      data.config ? JSON.stringify(data.config) : null
    ]
  );
  return result.insertId;
};

const update = async (id, data) => {
  const fields = [];
  const params = [];

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
  if (data.type !== undefined) { fields.push('type = ?'); params.push(data.type); }
  if (data.units_per_sale !== undefined) { fields.push('units_per_sale = ?'); params.push(parseInt(data.units_per_sale, 10) || 1); }
  if (data.price_includes_tax !== undefined) { fields.push('price_includes_tax = ?'); params.push(data.price_includes_tax ? 1 : 0); }
  if (data.commission_pct !== undefined) { fields.push('commission_pct = ?'); params.push(parseFloat(data.commission_pct) || 0); }
  if (data.gateway_pct !== undefined) { fields.push('gateway_pct = ?'); params.push(parseFloat(data.gateway_pct) || 0); }
  if (data.shipping_per_sale !== undefined) { fields.push('shipping_per_sale = ?'); params.push(parseFloat(data.shipping_per_sale) || 0); }
  if (data.other_variable_cost !== undefined) { fields.push('other_variable_cost = ?'); params.push(parseFloat(data.other_variable_cost) || 0); }
  if (data.fee_type !== undefined) { fields.push('fee_type = ?'); params.push(data.fee_type); }
  if (data.fee_value !== undefined) { fields.push('fee_value = ?'); params.push(parseFloat(data.fee_value) || 0); }
  if (data.config !== undefined) { fields.push('config = ?'); params.push(data.config ? JSON.stringify(data.config) : null); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }

  if (fields.length === 0) return;

  params.push(id);
  await query(`UPDATE sales_channels SET ${fields.join(', ')} WHERE id = ?`, params);
};

const toggleActive = async (id) => {
  await query('UPDATE sales_channels SET is_active = NOT is_active WHERE id = ?', [id]);
};

module.exports = { getAll, getById, create, update, toggleActive };
