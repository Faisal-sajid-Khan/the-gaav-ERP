import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Power, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Table from '../components/UI/Table';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import { formatCurrency, formatNumber } from '../utils/formatters';

export default function Products() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New Product Form State
  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    variant_name: 'Default',
    variant_sku: '',
    selling_price: '',
    mfg_cost: '',
    packaging_cost: '',
    other_cost: '0',
    initial_qty: '0',
    reorder_threshold: '10',
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products');
      const list = res.data?.data || res.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleToggleStatus = async (e, product) => {
    e.stopPropagation();
    try {
      const newStatus = product.status === 'active' ? 'inactive' : 'active';
      await api.patch(`/products/${product.id || product._id}`, { status: newStatus })
        .catch(async () => {
          return await api.put(`/products/${product.id || product._id}`, { ...product, status: newStatus });
        });
      addToast(`Product "${product.name}" marked ${newStatus}`, 'success');
      fetchProducts();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update product status', 'error');
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        description: form.description,
        category: form.category,
        variants: [
          {
            name: form.variant_name || 'Standard',
            sku: form.variant_sku || `${form.sku}-DEF`,
            selling_price: parseFloat(form.selling_price) || 0,
            manufacturing_cost: parseFloat(form.mfg_cost) || 0,
            packaging_cost: parseFloat(form.packaging_cost) || 0,
            other_cost: parseFloat(form.other_cost) || 0,
            initial_stock: parseInt(form.initial_qty, 10) || 0,
            reorder_threshold: parseInt(form.reorder_threshold, 10) || 10,
          }
        ]
      };

      await api.post('/products', payload);
      addToast('Product and primary variant created successfully', 'success');
      setIsModalOpen(false);
      setForm({
        name: '',
        sku: '',
        description: '',
        category: '',
        variant_name: 'Default',
        variant_sku: '',
        selling_price: '',
        mfg_cost: '',
        packaging_cost: '',
        other_cost: '0',
        initial_qty: '0',
        reorder_threshold: '10',
      });
      fetchProducts();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      key: 'name',
      label: 'Product Name',
      render: (val, row) => (
        <div>
          <span className="font-semibold text-gray-900 block hover:text-primary-600 transition-colors">{val}</span>
          {row.description && (
            <span className="text-xs text-gray-400 block truncate max-w-xs">{row.description}</span>
          )}
        </div>
      )
    },
    {
      key: 'sku',
      label: 'Master SKU',
      render: (val) => <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{val || 'N/A'}</span>
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => <span className="text-xs text-gray-600">{val || 'General'}</span>
    },
    {
      key: 'variants',
      label: 'Variants / SKUs',
      render: (val, row) => {
        const count = row.variant_count !== undefined ? Number(row.variant_count) : (Array.isArray(val) ? val.length : (val ? 1 : 0));
        return (
          <span className="text-xs font-medium text-gray-700 bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
            {count} {count === 1 ? 'Variant' : 'Variants'}
          </span>
        );
      }
    },
    {
      key: 'price',
      label: 'Price Range',
      render: (_, row) => {
        if (row.min_price !== undefined && row.min_price !== null) {
          const min = parseFloat(row.min_price || 0);
          const max = parseFloat(row.max_price || 0);
          return (
            <span className="text-xs font-semibold text-gray-900">
              {min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`}
            </span>
          );
        }
        const variants = row.variants || [];
        if (variants.length === 0) return <span className="text-xs text-gray-400">-</span>;
        const prices = variants.map(v => parseFloat(v.selling_price || 0));
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return (
          <span className="text-xs font-semibold text-gray-900">
            {min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`}
          </span>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <Badge status={val || 'active'} />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/products/${row.id || row._id}`)}
            className="p-1.5 rounded-md text-gray-500 hover:text-primary-600 hover:bg-gray-100 transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => handleToggleStatus(e, row)}
            className={`p-1.5 rounded-md transition-colors ${
              row.status === 'active'
                ? 'text-green-600 hover:text-red-600 hover:bg-red-50'
                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
            }`}
            title={row.status === 'active' ? 'Deactivate Product' : 'Activate Product'}
          >
            <Power className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Master Product Catalog</h2>
          <p className="text-xs text-gray-500">Manage all base products, variants, and cost architectures</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="shadow-xs">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name, master SKU, or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-medium">
          Total Products: <span className="font-bold text-gray-900">{filteredProducts.length}</span>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={filteredProducts}
          loading={loading}
          emptyMessage="No products found in catalog"
          onRowClick={(row) => navigate(`/products/${row.id || row._id}`)}
        />
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Master Product"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button form="create-product-form" type="submit" loading={saving}>
              Save Product & Variant
            </Button>
          </>
        }
      >
        <form id="create-product-form" onSubmit={handleCreateProduct} className="space-y-5">
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">1. Master Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pure Organic Desi Ghee"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Master SKU *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GHEE-MASTER"
                  value={form.sku}
                  onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Dairy / Provisions"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short product overview"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">2. Initial Variant & Cost Architecture</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Variant Name</label>
                <input
                  type="text"
                  placeholder="e.g. 500ml Jar"
                  value={form.variant_name}
                  onChange={e => setForm({ ...form, variant_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Variant SKU</label>
                <input
                  type="text"
                  placeholder="e.g. GHEE-500ML"
                  value={form.variant_sku}
                  onChange={e => setForm({ ...form, variant_sku: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs uppercase font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Selling Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 650.00"
                  value={form.selling_price}
                  onChange={e => setForm({ ...form, selling_price: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mfg / Procurement Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 320.00"
                  value={form.mfg_cost}
                  onChange={e => setForm({ ...form, mfg_cost: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Packaging Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 35.00"
                  value={form.packaging_cost}
                  onChange={e => setForm({ ...form, packaging_cost: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Other Direct Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 15.00"
                  value={form.other_cost}
                  onChange={e => setForm({ ...form, other_cost: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Initial Stock Units</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.initial_qty}
                  onChange={e => setForm({ ...form, initial_qty: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reorder Alert Threshold</label>
                <input
                  type="number"
                  placeholder="10"
                  value={form.reorder_threshold}
                  onChange={e => setForm({ ...form, reorder_threshold: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
