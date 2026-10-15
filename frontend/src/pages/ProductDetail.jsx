import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit2, Check, X, ShieldCheck, History,
  Layers, PackageCheck, AlertCircle, Save
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { formatCurrency, formatNumber, formatDate, formatDateTime } from '../utils/formatters';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingVariant, setSavingVariant] = useState(false);

  // New Variant Form
  const [newVariant, setNewVariant] = useState({
    name: '',
    sku: '',
    selling_price: '',
    manufacturing_cost: '',
    packaging_cost: '',
    other_cost: '0',
    initial_stock: '0',
    reorder_threshold: '10',
  });

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products/${id}`);
      setProduct(res.data?.data || res.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to fetch product details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchProduct();
  }, [id]);

  const handleStartEdit = (variant) => {
    setEditingVariantId(variant.id || variant._id);
    setEditForm({
      name: variant.name,
      sku: variant.sku,
      selling_price: variant.selling_price,
      manufacturing_cost: variant.manufacturing_cost,
      packaging_cost: variant.packaging_cost,
      other_cost: variant.other_cost || 0,
      reorder_threshold: variant.reorder_threshold || 10,
    });
  };

  const handleSaveEdit = async (variantId) => {
    try {
      await api.patch(`/products/variants/${variantId}`, editForm)
        .catch(async () => {
          return await api.put(`/products/${id}/variants/${variantId}`, editForm);
        });
      addToast('Variant updated successfully', 'success');
      setEditingVariantId(null);
      fetchProduct();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save variant changes', 'error');
    }
  };

  const handleCreateVariant = async (e) => {
    e.preventDefault();
    setSavingVariant(true);
    try {
      const payload = {
        name: newVariant.name,
        sku: newVariant.sku,
        selling_price: parseFloat(newVariant.selling_price) || 0,
        manufacturing_cost: parseFloat(newVariant.manufacturing_cost) || 0,
        packaging_cost: parseFloat(newVariant.packaging_cost) || 0,
        other_cost: parseFloat(newVariant.other_cost) || 0,
        initial_stock: parseInt(newVariant.initial_stock, 10) || 0,
        reorder_threshold: parseInt(newVariant.reorder_threshold, 10) || 10,
      };

      await api.post(`/products/${id}/variants`, payload);
      addToast('New variant added', 'success');
      setIsAddVariantOpen(false);
      setNewVariant({
        name: '',
        sku: '',
        selling_price: '',
        manufacturing_cost: '',
        packaging_cost: '',
        other_cost: '0',
        initial_stock: '0',
        reorder_threshold: '10',
      });
      fetchProduct();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to add variant', 'error');
    } finally {
      setSavingVariant(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Product not found</p>
        <Button onClick={() => navigate('/products')}>Return to Products</Button>
      </div>
    );
  }

  const variants = product.variants || [];
  const costHistory = product.cost_history || [];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/products')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </button>
        <div className="flex items-center gap-2">
          <Badge status={product.status || 'active'} />
          <Button size="sm" onClick={() => setIsAddVariantOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Variant
          </Button>
        </div>
      </div>

      {/* Master Overview Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                {product.sku}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Category: <span className="font-medium text-gray-700">{product.category || 'General'}</span>
            </p>
            {product.description && (
              <p className="text-sm text-gray-600 mt-2 max-w-2xl leading-relaxed">{product.description}</p>
            )}
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 block">Created</span>
              <span className="font-semibold text-gray-700">{formatDate(product.created_at)}</span>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div>
              <span className="text-gray-400 block">Active SKUs</span>
              <span className="font-semibold text-gray-700">{variants.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Variants & Cost Architecture Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-sm font-bold text-gray-900">SKU Variants & Cost Structure</h3>
            <p className="text-xs text-gray-500">Unit COGS breakdown determines true contribution margin per sale</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Variant Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-right">Mfg Cost</th>
                <th className="py-3 px-4 text-right">Packaging</th>
                <th className="py-3 px-4 text-right">Other Cost</th>
                <th className="py-3 px-4 text-right bg-indigo-50/50 text-indigo-900">Total Unit COGS</th>
                <th className="py-3 px-4 text-center">In Stock</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {variants.map(v => {
                const vid = v.id || v._id;
                const isEditing = editingVariantId === vid;
                const mfg = parseFloat(isEditing ? editForm.manufacturing_cost : v.manufacturing_cost) || 0;
                const pkg = parseFloat(isEditing ? editForm.packaging_cost : v.packaging_cost) || 0;
                const oth = parseFloat(isEditing ? editForm.other_cost : v.other_cost) || 0;
                const totalCogs = mfg + pkg + oth;

                return (
                  <tr key={vid} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          className="px-2 py-1 border rounded text-xs w-28"
                        />
                      ) : (
                        v.name
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.sku}
                          onChange={e => setEditForm({ ...editForm, sku: e.target.value.toUpperCase() })}
                          className="px-2 py-1 border rounded text-xs font-mono w-28 uppercase"
                        />
                      ) : (
                        v.sku
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.selling_price}
                          onChange={e => setEditForm({ ...editForm, selling_price: e.target.value })}
                          className="px-2 py-1 border rounded text-xs w-20 text-right"
                        />
                      ) : (
                        formatCurrency(v.selling_price)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.manufacturing_cost}
                          onChange={e => setEditForm({ ...editForm, manufacturing_cost: e.target.value })}
                          className="px-2 py-1 border rounded text-xs w-20 text-right"
                        />
                      ) : (
                        formatCurrency(v.manufacturing_cost)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.packaging_cost}
                          onChange={e => setEditForm({ ...editForm, packaging_cost: e.target.value })}
                          className="px-2 py-1 border rounded text-xs w-20 text-right"
                        />
                      ) : (
                        formatCurrency(v.packaging_cost)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.other_cost}
                          onChange={e => setEditForm({ ...editForm, other_cost: e.target.value })}
                          className="px-2 py-1 border rounded text-xs w-16 text-right"
                        />
                      ) : (
                        formatCurrency(v.other_cost || 0)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-indigo-700 bg-indigo-50/40">
                      {formatCurrency(totalCogs)}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-gray-800">
                      {formatNumber(v.available_qty ?? v.stock_quantity ?? v.available_units ?? 0)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(vid)}
                            className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                            title="Save changes"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingVariantId(null)}
                            className="p-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(v)}
                          className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-gray-100"
                          title="Edit Costs"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost History Audit Log */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-bold text-gray-900">Cost Architecture Version History</h3>
        </div>

        {costHistory.length === 0 ? (
          <p className="text-xs text-gray-400">No previous cost updates recorded for this master product.</p>
        ) : (
          <div className="space-y-3">
            {costHistory.map((item, index) => (
              <div key={index} className="flex items-start justify-between p-3 rounded-lg bg-gray-50 text-xs">
                <div>
                  <span className="font-semibold text-gray-900">{item.variant_name || 'Variant'}</span>
                  <p className="text-gray-500 mt-0.5">
                    Mfg: {formatCurrency(item.manufacturing_cost)} | Pkg: {formatCurrency(item.packaging_cost)}
                  </p>
                </div>
                <div className="text-right text-gray-400">
                  <span>{formatDateTime(item.changed_at || item.created_at)}</span>
                  <span className="block text-[10px] text-gray-500">{item.changed_by || 'Admin'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Variant Modal */}
      <Modal
        isOpen={isAddVariantOpen}
        onClose={() => setIsAddVariantOpen(false)}
        title={`Add Variant to ${product.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddVariantOpen(false)}>
              Cancel
            </Button>
            <Button form="create-variant-form" type="submit" loading={savingVariant}>
              Add Variant
            </Button>
          </>
        }
      >
        <form id="create-variant-form" onSubmit={handleCreateVariant} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Variant Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. 1 Litre Tin"
                value={newVariant.name}
                onChange={e => setNewVariant({ ...newVariant, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Variant SKU *</label>
              <input
                type="text"
                required
                placeholder="e.g. GHEE-1L-TIN"
                value={newVariant.sku}
                onChange={e => setNewVariant({ ...newVariant, sku: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Selling Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={newVariant.selling_price}
                onChange={e => setNewVariant({ ...newVariant, selling_price: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mfg / Procurement Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                value={newVariant.manufacturing_cost}
                onChange={e => setNewVariant({ ...newVariant, manufacturing_cost: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Packaging Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                value={newVariant.packaging_cost}
                onChange={e => setNewVariant({ ...newVariant, packaging_cost: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Other Direct Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                value={newVariant.other_cost}
                onChange={e => setNewVariant({ ...newVariant, other_cost: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Initial Stock Units</label>
              <input
                type="number"
                value={newVariant.initial_stock}
                onChange={e => setNewVariant({ ...newVariant, initial_stock: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reorder Threshold</label>
              <input
                type="number"
                value={newVariant.reorder_threshold}
                onChange={e => setNewVariant({ ...newVariant, reorder_threshold: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
