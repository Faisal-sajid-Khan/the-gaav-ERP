import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Warehouse, Search, AlertTriangle, ArrowUpDown, History,
  Plus, Minus, RefreshCw, CheckCircle2, ShieldAlert
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Table from '../components/UI/Table';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import StatCard from '../components/UI/StatCard';
import { formatCurrency, formatNumber } from '../utils/formatters';

export default function Inventory() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [adjustType, setAdjustType] = useState('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory');
      const list = res.data?.data || res.data || [];
      setInventory(Array.isArray(list) ? list : []);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to fetch inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openAdjustModal = (item) => {
    setSelectedItem(item);
    setAdjustType('add');
    setAdjustQty('');
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    setAdjusting(true);
    try {
      const currentQty = parseInt(selectedItem.available_qty ?? selectedItem.available_units ?? 0, 10);
      const inputQty = parseInt(adjustQty, 10) || 0;
      let newQty = inputQty;

      if (adjustType === 'add') {
        newQty = currentQty + inputQty;
      } else if (adjustType === 'subtract') {
        newQty = Math.max(0, currentQty - inputQty);
      } else {
        newQty = inputQty;
      }

      const payload = {
        variant_id: selectedItem.variant_id || selectedItem.id || selectedItem._id,
        location_id: selectedItem.location_id || 1,
        new_qty: newQty,
        reason: adjustReason || 'Manual adjustment from inventory screen',
      };

      await api.post('/inventory/adjust', payload);
      addToast('Inventory adjusted successfully', 'success');
      setIsAdjustModalOpen(false);
      fetchInventory();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to adjust inventory', 'error');
    } finally {
      setAdjusting(false);
    }
  };

  // Calculations for summary cards
  const totalSkus = inventory.length;
  const totalUnits = inventory.reduce((sum, item) => sum + (parseInt(item.available_qty ?? item.available_units ?? item.stock_quantity ?? 0, 10)), 0);
  const lowStockCount = inventory.filter(item => {
    const avail = parseInt(item.available_qty ?? item.available_units ?? item.stock_quantity ?? 0, 10);
    const threshold = parseInt(item.reorder_threshold ?? 10, 10);
    return avail <= threshold;
  }).length;

  const totalValue = inventory.reduce((sum, item) => {
    const units = parseInt(item.available_qty ?? item.available_units ?? item.stock_quantity ?? 0, 10);
    const cost = parseFloat(item.selling_price ?? item.unit_cost ?? item.manufacturing_cost ?? 0);
    return sum + (units * cost);
  }, 0);

  const filteredItems = inventory.filter(item => {
    const q = search.toLowerCase();
    const matchesSearch =
      item.product_name?.toLowerCase().includes(q) ||
      item.variant_name?.toLowerCase().includes(q) ||
      item.sku?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (onlyLowStock) {
      const avail = parseInt(item.available_qty ?? item.available_units ?? item.stock_quantity ?? 0, 10);
      const threshold = parseInt(item.reorder_threshold ?? 10, 10);
      return avail <= threshold;
    }
    return true;
  });

  const columns = [
    {
      key: 'product_name',
      label: 'Product & Variant',
      render: (val, row) => (
        <div>
          <span className="font-semibold text-gray-900 block">{val}</span>
          <span className="text-xs text-gray-500">{row.variant_name || 'Standard'}</span>
        </div>
      )
    },
    {
      key: 'sku',
      label: 'Variant SKU',
      render: (val) => <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{val}</span>
    },
    {
      key: 'available_qty',
      label: 'Available Stock',
      className: 'text-center',
      render: (val, row) => {
        const units = parseInt(row.available_qty ?? val ?? row.available_units ?? row.stock_quantity ?? 0, 10);
        const threshold = parseInt(row.reorder_threshold ?? 10, 10);
        const isLow = units <= threshold;
        return (
          <div className="text-center">
            <span className={`font-bold text-sm ${units === 0 ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-700'}`}>
              {formatNumber(units)}
            </span>
            {row.shopify_available !== undefined && row.shopify_available !== null && (
              <span className="block text-[10px] text-gray-400 font-mono">
                Shopify: {formatNumber(row.shopify_available)}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'reserved_qty',
      label: 'Reserved / Pending',
      className: 'text-center',
      render: (val, row) => <span className="text-xs text-gray-500">{formatNumber(row.reserved_qty ?? val ?? 0)}</span>
    },
    {
      key: 'reorder_threshold',
      label: 'Threshold',
      className: 'text-center',
      render: (val) => <span className="text-xs text-gray-500">{val || 10}</span>
    },
    {
      key: 'status',
      label: 'Stock Health',
      render: (_, row) => {
        const units = parseInt(row.available_qty ?? row.available_units ?? row.stock_quantity ?? 0, 10);
        const threshold = parseInt(row.reorder_threshold ?? 10, 10);
        if (units === 0) return <Badge status="out_of_stock" label="Out Of Stock" />;
        if (units <= threshold) return <Badge status="low_stock" label="Low Stock" />;
        return <Badge status="in_stock" label="In Stock" />;
      }
    },
    {
      key: 'total_value',
      label: 'Stock Value',
      className: 'text-right',
      render: (_, row) => {
        const units = parseInt(row.available_qty ?? row.available_units ?? row.stock_quantity ?? 0, 10);
        const price = parseFloat(row.selling_price || 0);
        const cost = parseFloat(row.unit_cost ?? row.manufacturing_cost ?? 0);
        return (
          <div className="text-right">
            <span className="font-semibold text-gray-900 block">{formatCurrency(units * price)}</span>
            {cost > 0 && <span className="text-[10px] text-gray-400">Cost: {formatCurrency(units * cost)}</span>}
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: 'Action',
      render: (_, row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openAdjustModal(row)}
          className="text-xs"
        >
          <ArrowUpDown className="h-3 w-3" />
          Adjust
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Inventory Status & Valuations</h2>
          <p className="text-xs text-gray-500">Live warehouse quantities, reserved orders, and reorder alerts</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/inventory/movements')}>
          <History className="h-4 w-4" />
          Stock Movements Ledger
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tracked SKUs"
          value={formatNumber(totalSkus)}
          subtitle="Unique variant items"
          icon={Warehouse}
          color="primary"
          loading={loading}
        />
        <StatCard
          title="Units In Stock"
          value={formatNumber(totalUnits)}
          subtitle="Physical units available"
          icon={CheckCircle2}
          color="green"
          loading={loading}
        />
        <StatCard
          title="Total Stock Value"
          value={formatCurrency(totalValue)}
          subtitle="At manufacturing COGS"
          icon={Warehouse}
          color="purple"
          loading={loading}
        />
        <StatCard
          title="Low Stock SKUs"
          value={formatNumber(lowStockCount)}
          subtitle="Action required soon"
          icon={AlertTriangle}
          color={lowStockCount > 0 ? 'red' : 'green'}
          loading={loading}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product, variant name, or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              onlyLowStock
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {onlyLowStock ? 'Showing Low Stock Only' : 'Filter Low Stock'}
          </button>
          <Button variant="secondary" size="sm" onClick={fetchInventory} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={filteredItems}
          loading={loading}
          emptyMessage="No inventory items found"
        />
      </div>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={selectedItem ? `Adjust Stock: ${selectedItem.product_name} (${selectedItem.sku})` : 'Adjust Stock'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button form="adjust-form" type="submit" loading={adjusting}>
              Save Stock Adjustment
            </Button>
          </>
        }
      >
        <form id="adjust-form" onSubmit={handleAdjustSubmit} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg border text-xs flex justify-between items-center">
            <span className="text-gray-500">Current Stock Available:</span>
            <span className="font-bold text-gray-900 text-sm">
              {formatNumber(selectedItem?.available_qty ?? selectedItem?.available_units ?? selectedItem?.stock_quantity ?? 0)} units
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Adjustment Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAdjustType('add')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                  adjustType === 'add'
                    ? 'bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Add (Restock)
              </button>
              <button
                type="button"
                onClick={() => setAdjustType('subtract')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                  adjustType === 'subtract'
                    ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <Minus className="h-3.5 w-3.5" />
                Deduct (Damage)
              </button>
              <button
                type="button"
                onClick={() => setAdjustType('set')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                  adjustType === 'set'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Set Exact Qty
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {adjustType === 'set' ? 'New Exact Count *' : 'Quantity Change *'}
            </label>
            <input
              type="number"
              min="1"
              required
              placeholder="e.g. 50"
              value={adjustQty}
              onChange={e => setAdjustQty(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason / Reference *</label>
            <input
              type="text"
              required
              placeholder="e.g. Batch #B-409 production arrival, packaging transit damage"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
