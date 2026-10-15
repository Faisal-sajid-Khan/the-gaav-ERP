import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Filter, RefreshCw, Calendar } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Table from '../components/UI/Table';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Pagination from '../components/UI/Pagination';
import { formatDate, formatDateTime, formatNumber } from '../utils/formatters';

export default function InventoryMovements() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  const fetchMovements = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        search: search || undefined,
        type: typeFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };

      const res = await api.get('/inventory/movements', { params });
      const list = res.data?.data || res.data || [];
      setMovements(Array.isArray(list) ? list : []);

      if (res.data?.pagination) {
        setPagination(res.data.pagination);
      } else {
        setPagination(prev => ({
          ...prev,
          total: list.length,
          totalPages: Math.ceil(list.length / prev.limit) || 1,
        }));
      }
      setCurrentPage(page);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to fetch inventory movements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements(1);
  }, [typeFilter, startDate, endDate]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMovements(1);
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Timestamp',
      render: (val, row) => (
        <span className="text-xs text-gray-500 font-mono">
          {formatDateTime(val || row.movement_date || row.timestamp)}
        </span>
      )
    },
    {
      key: 'product_name',
      label: 'Product & Variant',
      render: (val, row) => (
        <div>
          <span className="font-semibold text-gray-900 block">{val || row.product?.name}</span>
          <span className="text-xs text-gray-500">{row.variant_name || row.variant?.name || 'Standard'}</span>
        </div>
      )
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (val, row) => (
        <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
          {val || row.variant?.sku}
        </span>
      )
    },
    {
      key: 'type',
      label: 'Movement Type',
      render: (val) => {
        const typeStr = val || 'adjustment';
        let badgeVariant = 'neutral';
        if (['restock', 'purchase', 'inward', 'return_restock'].includes(typeStr)) badgeVariant = 'success';
        if (['sale', 'order_dispatch'].includes(typeStr)) badgeVariant = 'info';
        if (['damage', 'loss', 'shrinkage'].includes(typeStr)) badgeVariant = 'error';
        return <Badge status={typeStr} variant={badgeVariant} />;
      }
    },
    {
      key: 'quantity_change',
      label: 'Delta',
      className: 'text-center',
      render: (val, row) => {
        const delta = parseInt(val ?? row.change ?? 0, 10);
        return (
          <span className={`font-bold font-mono text-xs px-2 py-0.5 rounded-full ${
            delta > 0
              ? 'bg-green-100 text-green-800'
              : (delta < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700')
          }`}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        );
      }
    },
    {
      key: 'quantity_before',
      label: 'Before',
      className: 'text-center',
      render: (val) => <span className="text-xs text-gray-600 font-mono">{formatNumber(val || 0)}</span>
    },
    {
      key: 'quantity_after',
      label: 'After',
      className: 'text-center',
      render: (val) => <span className="text-xs font-bold text-gray-900 font-mono">{formatNumber(val || 0)}</span>
    },
    {
      key: 'reference',
      label: 'Reference / Source',
      render: (val, row) => (
        <span className="text-xs text-primary-600 font-mono">
          {val || row.order_number || row.reference_id || 'Manual'}
        </span>
      )
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (val, row) => (
        <span className="text-xs text-gray-500 italic truncate max-w-xs block">
          {val || row.reason || '-'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/inventory')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory Tracking
          </button>
          <h2 className="text-lg font-bold text-gray-900">Inventory Movements Ledger</h2>
          <p className="text-xs text-gray-500">Immutable audit record of every stock in, out, and adjustment event</p>
        </div>

        <Button variant="secondary" size="sm" onClick={() => fetchMovements(1)} loading={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by SKU, product name, or reference..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" className="w-full sm:w-auto">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All Movement Types</option>
            <option value="sale">Sales Order Dispatch</option>
            <option value="restock">Restock / Inward</option>
            <option value="damage">Damage / Waste</option>
            <option value="adjustment">Manual Adjustment</option>
            <option value="return_restock">Customer Return</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {(typeFilter || startDate || endDate || search) && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-2 py-1 rounded"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={movements}
          loading={loading}
          emptyMessage="No stock movements recorded"
        />

        <div className="p-4 border-t border-gray-100">
          <Pagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={fetchMovements}
          />
        </div>
      </div>
    </div>
  );
}
