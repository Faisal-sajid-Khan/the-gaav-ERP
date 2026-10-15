import React, { useState, useEffect } from 'react';
import { Plus, Store, Check, Power, Percent, ExternalLink, Pencil } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Table from '../components/UI/Table';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import { formatPercent, formatCurrency, formatDate } from '../utils/formatters';

export default function SalesChannels() {
  const { addToast } = useToast();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'shopify',
    units_per_sale: 1,
    price_includes_tax: true,
    commission_pct: '0',
    gateway_pct: '0',
    shipping_per_sale: '0',
    other_variable_cost: '0',
    description: '',
    is_active: true,
  });

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await api.get('/channels');
      const list = res.data?.data || res.data || [];
      setChannels(Array.isArray(list) ? list : []);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to fetch sales channels', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleOpenCreate = () => {
    setEditingChannelId(null);
    setForm({
      name: '',
      type: 'shopify',
      units_per_sale: 1,
      price_includes_tax: true,
      commission_pct: '0',
      gateway_pct: '0',
      shipping_per_sale: '0',
      other_variable_cost: '0',
      description: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (channel) => {
    setEditingChannelId(channel.id || channel._id);
    setForm({
      name: channel.name || '',
      type: channel.type || 'other',
      units_per_sale: channel.units_per_sale || 1,
      price_includes_tax: channel.price_includes_tax !== 0,
      commission_pct: ((parseFloat(channel.commission_pct) || 0) * 100).toString(),
      gateway_pct: ((parseFloat(channel.gateway_pct) || 0) * 100).toString(),
      shipping_per_sale: (parseFloat(channel.shipping_per_sale) || 0).toString(),
      other_variable_cost: (parseFloat(channel.other_variable_cost) || 0).toString(),
      description: channel.description || '',
      is_active: channel.is_active !== 0,
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (channel) => {
    try {
      const updatedStatus = !channel.is_active;
      await api.patch(`/channels/${channel.id || channel._id}`, { is_active: updatedStatus })
        .catch(async () => {
          return await api.put(`/channels/${channel.id || channel._id}`, { ...channel, is_active: updatedStatus });
        });
      addToast(`Channel "${channel.name}" updated`, 'success');
      fetchChannels();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to toggle status', 'error');
    }
  };

  const handleSubmitChannel = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        units_per_sale: parseInt(form.units_per_sale, 10) || 1,
        price_includes_tax: form.price_includes_tax ? 1 : 0,
        commission_pct: (parseFloat(form.commission_pct) || 0) / 100,
        gateway_pct: (parseFloat(form.gateway_pct) || 0) / 100,
        shipping_per_sale: parseFloat(form.shipping_per_sale) || 0,
        other_variable_cost: parseFloat(form.other_variable_cost) || 0,
        description: form.description,
        is_active: form.is_active,
      };

      if (editingChannelId) {
        await api.put(`/channels/${editingChannelId}`, payload);
        addToast('Sales channel updated successfully', 'success');
      } else {
        await api.post('/channels', payload);
        addToast('Sales channel created successfully', 'success');
      }
      setIsModalOpen(false);
      setEditingChannelId(null);
      fetchChannels();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save channel', 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Channel Name',
      render: (val, row) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-xs">
            {val ? val[0].toUpperCase() : 'C'}
          </div>
          <div>
            <span className="font-semibold text-gray-900 block">{val}</span>
            <span className="text-xs text-gray-400 capitalize">{row.type || 'Standard'}</span>
          </div>
        </div>
      )
    },
    {
      key: 'units_per_sale',
      label: 'Pack Sizing',
      render: (val) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800">
          {val || 1} {val === 1 ? 'bar / sale' : 'bars / bundle'}
        </span>
      )
    },
    {
      key: 'price_includes_tax',
      label: 'Tax Inclusion',
      render: (val) => (
        <Badge status={val !== 0 ? 'Tax Inclusive' : 'Tax Exclusive'} />
      )
    },
    {
      key: 'commission_pct',
      label: 'Take-Rate (%)',
      render: (val, row) => {
        const comm = (parseFloat(row.commission_pct || 0) * 100).toFixed(1);
        const gwy = (parseFloat(row.gateway_pct || 0) * 100).toFixed(1);
        return (
          <div className="text-xs font-medium text-gray-700">
            <span>{comm}% comm.</span>
            {parseFloat(gwy) > 0 && <span className="text-gray-400 ml-1">+ {gwy}% gwy</span>}
          </div>
        );
      }
    },
    {
      key: 'shipping_per_sale',
      label: 'Per-Sale Flat Cost',
      render: (val, row) => {
        const ship = parseFloat(row.shipping_per_sale || 0);
        const other = parseFloat(row.other_variable_cost || 0);
        const total = ship + other;
        return (
          <span className="text-xs font-mono font-bold text-gray-900">
            {total > 0 ? formatCurrency(total) : '₹0.00'}
          </span>
        );
      }
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (val) => <Badge status={val ? 'active' : 'inactive'} />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-md text-primary-600 hover:bg-primary-50 transition-colors text-xs font-semibold flex items-center gap-1 border border-primary-200"
            title="Edit Channel Economics"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded-md transition-colors text-xs font-semibold flex items-center gap-1 ${
              row.is_active
                ? 'text-red-600 hover:bg-red-50'
                : 'text-green-600 hover:bg-green-50'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {row.is_active ? 'Disable' : 'Enable'}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Sales Channels & Platform Economics</h2>
          <p className="text-xs text-gray-500">Configure bundle pack sizes, tax inclusion, and variable channel costs (Formulas 2, 5 & 7)</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          Add Channel
        </Button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={channels}
          loading={loading}
          emptyMessage="No sales channels configured yet."
        />
      </div>

      {/* Channel Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingChannelId(null); }}
        title={editingChannelId ? 'Edit Sales Channel Economics' : 'Add Sales Channel & Unit-Economics Parameters'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setIsModalOpen(false); setEditingChannelId(null); }}>
              Cancel
            </Button>
            <Button form="create-channel-form" type="submit" loading={saving}>
              {editingChannelId ? 'Save Changes' : 'Create Channel'}
            </Button>
          </>
        }
      >
        <form id="create-channel-form" onSubmit={handleSubmitChannel} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Channel Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Shopify Main Store, WhatsApp D2C, 3-Bar Bundle Pack"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Platform Type</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="shopify">Shopify Store</option>
                <option value="whatsapp">WhatsApp Commerce</option>
                <option value="instagram">Instagram Direct</option>
                <option value="offline">Offline / Direct Store</option>
                <option value="distributor">Distributor / B2B</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Units per Sale (Bars Count) *</label>
              <input
                type="number"
                min="1"
                required
                value={form.units_per_sale}
                onChange={e => setForm({ ...form, units_per_sale: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Formula 2: sale_count = bars ÷ channel.units_per_sale</p>
            </div>
          </div>

          {/* Tax Inclusion Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div>
              <span className="text-xs font-semibold text-gray-900 block">Price Includes Tax (Formula 5)</span>
              <span className="text-[11px] text-gray-500">
                When enabled, tax is extracted: net_billed × tax_rate ÷ (1 + tax_rate)
              </span>
            </div>
            <input
              type="checkbox"
              checked={form.price_includes_tax}
              onChange={e => setForm({ ...form, price_includes_tax: e.target.checked })}
              className="h-4 w-4 text-primary-600 rounded"
            />
          </div>

          {/* Channel Take-Rate Percentages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Platform Commission (%)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 5.0"
                value={form.commission_pct}
                onChange={e => setForm({ ...form, commission_pct: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Gateway Fee (%)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 2.0"
                value={form.gateway_pct}
                onChange={e => setForm({ ...form, gateway_pct: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Per-Sale Flat Costs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Shipping Cost per Sale (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.shipping_per_sale}
                onChange={e => setForm({ ...form, shipping_per_sale: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Other Variable Cost per Sale (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.other_variable_cost}
                onChange={e => setForm({ ...form, other_variable_cost: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description / Notes</label>
            <textarea
              rows="2"
              placeholder="Internal channel notes"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
