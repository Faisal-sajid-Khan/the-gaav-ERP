'use strict';
const model = require('./productModel');
const { success, error, paginated } = require('../../utils/responseHelper');
const { auditLog } = require('../../utils/auditLogger');

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', is_active } = req.query;
    const { products, total } = await model.getAll({ page, limit, search, is_active });
    return paginated(res, products, total, page, limit);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const product = await model.getById(req.params.id);
    if (!product) return error(res, 'Product not found', 404);
    return success(res, product);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, sku, description, shopify_product_id, variants } = req.body;
    if (!name) return error(res, 'Product name is required', 400);
    if (sku && await model.checkDuplicateSKU(sku)) return error(res, 'SKU already exists', 409);

    const productId = await model.create({ name, sku, description, shopify_product_id });

    if (variants && variants.length > 0) {
      for (const v of variants) {
        await model.createVariant(productId, v, req.user?.id);
      }
    } else {
      await model.createVariant(productId, { name: 'Default', selling_price: req.body.selling_price || 0 }, req.user?.id);
    }

    await auditLog({ userId: req.user?.id, action: 'PRODUCT_CREATED', entityType: 'product', entityId: productId, ipAddress: req.ip });
    const product = await model.getById(productId);
    return success(res, product, 'Product created successfully', 201);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const product = await model.getById(req.params.id);
    if (!product) return error(res, 'Product not found', 404);
    await model.update(req.params.id, req.body);
    await auditLog({ userId: req.user?.id, action: 'PRODUCT_UPDATED', entityType: 'product', entityId: req.params.id, ipAddress: req.ip });
    return success(res, await model.getById(req.params.id), 'Product updated successfully');
  } catch (err) { next(err); }
};

const deactivate = async (req, res, next) => {
  try {
    const product = await model.getById(req.params.id);
    if (!product) return error(res, 'Product not found', 404);
    await model.update(req.params.id, { ...product, is_active: 0 });
    await auditLog({ userId: req.user?.id, action: 'PRODUCT_DEACTIVATED', entityType: 'product', entityId: req.params.id, ipAddress: req.ip });
    return success(res, null, 'Product deactivated successfully');
  } catch (err) { next(err); }
};

const addVariant = async (req, res, next) => {
  try {
    const product = await model.getById(req.params.id);
    if (!product) return error(res, 'Product not found', 404);
    const variantId = await model.createVariant(req.params.id, req.body, req.user?.id);
    await auditLog({ userId: req.user?.id, action: 'VARIANT_CREATED', entityType: 'variant', entityId: variantId, ipAddress: req.ip });
    return success(res, await model.getVariantById(variantId), 'Variant added successfully', 201);
  } catch (err) { next(err); }
};

const updateVariant = async (req, res, next) => {
  try {
    const variant = await model.getVariantById(req.params.variantId);
    if (!variant) return error(res, 'Variant not found', 404);
    await model.updateVariant(req.params.variantId, req.body, req.user?.id);
    await auditLog({ userId: req.user?.id, action: 'VARIANT_UPDATED', entityType: 'variant', entityId: req.params.variantId, ipAddress: req.ip });
    return success(res, await model.getVariantById(req.params.variantId), 'Variant updated successfully');
  } catch (err) { next(err); }
};

const getCostHistory = async (req, res, next) => {
  try {
    const history = await model.getCostHistory(req.params.variantId);
    return success(res, history);
  } catch (err) { next(err); }
};

const getVariants = async (req, res, next) => {
  try {
    const product = await model.getById(req.params.id);
    if (!product) return error(res, 'Product not found', 404);
    return success(res, product.variants);
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, deactivate, addVariant, updateVariant, getCostHistory, getVariants };
