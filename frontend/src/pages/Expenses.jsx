import React, { useState, useEffect } from 'react';
import {
  Receipt, Plus, DollarSign, Calendar, Filter, Trash2,
  AlertCircle, Check, Tag, PieChart as PieIcon, Layers
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Table from '../components/UI/Table';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import StatCard from '../components/UI/StatCard';
import { formatCurrency, formatDate } from '../utils/formatters';

const EXPENSE_CATEGORIES = [
  'Rent & Facilities',
  'Marketing & Paid Ads',
  'Salaries & Payroll',
  'Software & Subscriptions',
  'Utilities & Electricity',
  'Packaging & Supplies',
  'Logistics & Courier Retainers',
  'Legal & Accounting',
  'Other Operational Expense'
];

export default function Expenses() {
  const { addToast } = useToast();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form State
  const [form, setForm] = useState({
    title: '',
    category: 'Rent & Facilities',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    is_cogs: false,
    notes: '',
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses', {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          category: categoryFilter || undefined,
        }
      });
      const list = res.data?.data?.expenses || res.data?.expenses || res.data?.data || [];
      setExpenses(Array.isArray(list) ? list : []);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to fetch expenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [categoryFilter, startDate, endDate]);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        expense_date: form.expense_date,
        is_cogs: form.is_cogs,
        notes: form.notes.trim() || null,
      };

      await api.post('/expenses', payload);
      addToast('Expense recorded successfully', 'success');
      setIsModalOpen(false);
      setForm({
        title: '',
        category: 'Rent & Facilities',
        amount: '',
        expense_date: new Date().toISOString().slice(0, 10),
        is_cogs: false,
        notes: '',
      });
      fetchExpenses();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to log expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await api.delete(`/expenses/${id}`);
      addToast('Expense record deleted successfully', 'success');
      fetchExpenses();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete expense', 'error');
    }
  };

  // Summaries
  const totalOverheads = expenses
    .filter(e => !e.is_cogs)
    .reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

  const totalCogsExpenses = expenses
    .filter(e => e.is_cogs)
    .reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

  const totalAllExpenses = totalOverheads + totalCogsExpenses;

  const columns = [
    {
      key: 'expense_date',
      label: 'Date',
      render: (val) => <span className="text-xs text-gray-600 font-mono">{formatDate(val)}</span>
    },
    {
      key: 'title',
      label: 'Title / Description',
      render: (val, row) => (
        <div>
          <span className="font-semibold text-gray-900 block">{val}</span>
          {row.notes && <span className="text-[11px] text-gray-400">{row.notes}</span>}
        </div>
      )
    },
    {
      key: 'category',
      label: 'Expense Category',
      render: (val) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
          <Tag className="h-3 w-3 text-gray-500" />
          {val}
        </span>
      )
    },
    {
      key: 'is_cogs',
      label: 'Accounting Type',
      render: (val) => (
        val ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            COGS (Excluded from Overheads)
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            Fixed Overhead (Formula 14 & 15)
          </span>
        )
      )
    },
    {
      key: 'amount',
      label: 'Amount (₹)',
      className: 'text-right',
      render: (val) => (
        <span className="font-mono font-bold text-sm text-gray-900">
          {formatCurrency(val)}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-center',
      render: (_, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleDeleteExpense(row.id || row._id);
          }}
          className="p-1.5 text-red-500 hover:text-white hover:bg-red-600 rounded-lg transition-colors border border-red-200"
          title="Delete expense"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Overheads & Operating Expenses</h2>
          <p className="text-xs text-gray-500">
            Track business operating expenses to compute True Net Profit (Formula 14) and Break-Even Volume (Formula 15)
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Log Expense
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Period Overheads"
          value={formatCurrency(totalOverheads)}
          subtitle="Fixed operating expenses (Formula 14)"
          icon={Receipt}
          color="purple"
          loading={loading}
        />
        <StatCard
          title="Total Direct COGS Expenses"
          value={formatCurrency(totalCogsExpenses)}
          subtitle="Direct production cost items"
          icon={Layers}
          color="amber"
          loading={loading}
        />
        <StatCard
          title="Total Expenditure"
          value={formatCurrency(totalAllExpenses)}
          subtitle={`${expenses.length} expense record(s)`}
          icon={DollarSign}
          color="blue"
          loading={loading}
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="text-xs font-semibold text-gray-500">
          Formulas: <span className="font-mono text-purple-700">Net Profit = Contribution − Overheads</span> | <span className="font-mono text-blue-700">Break-Even = Overheads ÷ Unit Margin</span>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={expenses}
          loading={loading}
          emptyMessage="No expense records logged in this period. Click 'Log Expense' to add one."
        />
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Operating Expense"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button form="create-expense-form" type="submit" loading={saving}>
              Save Expense
            </Button>
          </>
        }
      >
        <form id="create-expense-form" onSubmit={handleCreateExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Expense Title / Payee *</label>
            <input
              type="text"
              required
              placeholder="e.g. Warehouse Rent Oct 2026, Meta Ads, Shopify App Bills"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-gray-400 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Expense Date *</label>
            <input
              type="date"
              required
              value={form.expense_date}
              onChange={e => setForm({ ...form, expense_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {/* COGS vs Overhead flag */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <input
              type="checkbox"
              id="is_cogs_check"
              checked={form.is_cogs}
              onChange={e => setForm({ ...form, is_cogs: e.target.checked })}
              className="h-4 w-4 text-primary-600 rounded mt-0.5"
            />
            <label htmlFor="is_cogs_check" className="cursor-pointer">
              <span className="text-xs font-semibold text-gray-900 block">Flag as Cost-of-Goods (COGS)</span>
              <span className="text-[11px] text-gray-500 block mt-0.5">
                Formula 14 rule: Overheads come from EXPENSE, excluding any category flagged as cost-of-goods.
                Leave unchecked for rent, payroll, utilities, and marketing overheads.
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea
              rows="2"
              placeholder="Vendor invoice number, payment reference, or payment method"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
