import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, RefreshCw, Calendar } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Table from '../components/UI/Table';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Pagination from '../components/UI/Pagination';
import { formatCurrency, formatDate, formatPercent } from '../utils/formatters';

export default function Orders() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);

  // Filter States
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 15 });

  const fetchChannels = async () => {
    try {
      const res = await api.get('/channels');
      const list = res.data?.data || res.data || [];
      setChannels(Array.isArray(list) ? list : []);
    } catch {}
  };

  const fetchOrders = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        search: search || undefined,
        channel_id: channelFilter || undefined,
        status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };

      const res = await api.get('/orders', { params });
      const list = res.data?.data || res.data || [];
      setOrders(Array.isArray(list) ? list : []);

      if (res.data?.pagination) {
        setPagination(res.data.pagination);
      } else {
        setPagination(prev => ({
          ...prev,
          total: list.length,
          totalPages: Math.ceil(list.length / prev.limit) || 1
        }));
      }
      setCurrentPage(page);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [channelFilter, statusFilter, paymentFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders(1);
  };

  const columns = [
    {
      key: 'order_number',
      label: 'Order #',
      render: (val, row) => (
        <span className="font-semibold text-primary-600 hover:text-primary-800 transition-colors">
          {val || `#${row.id}`}
        </span>
      )
    },
    {
      key: 'order_date',
      label: 'Date',
      render: (val, row) => <span className="text-xs text-gray-500">{formatDate(val || row.created_at)}</span>
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (val) => <span className="font-medium text-gray-800">{val || 'Direct Walk-in'}</span>
    },
    {
      key: 'channel',
      label: 'Channel',
      render: (val, row) => {
        const name = val?.name || row.channel_name || row.channel_type || 'offline';
        return <Badge status={name} />;
      }
    },
    {
      key: 'items',
      label: 'Items',
      render: (val, row) => {
        const count = row.item_count !== undefined ? Number(row.item_count) : (val || row.order_items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
        return <span className="text-xs text-gray-600">{count} {count === 1 ? 'item' : 'items'}</span>;
      }
    },
    {
      key: 'net_sales',
      label: 'Net Sales',
      className: 'text-right',
      render: (val, row) => (
        <span className="font-semibold text-gray-900">
          {formatCurrency(val ?? row.total_amount)}
        </span>
      )
    },
    {
      key: 'contribution_amount',
      label: 'Contribution',
      className: 'text-right',
      render: (val) => {
        const num = parseFloat(val) || 0;
        return (
          <span className={`font-semibold ${num >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(num)}
          </span>
        );
      }
    },
    {
      key: 'contribution_margin',
      label: 'Margin %',
      className: 'text-right',
      render: (val) => (
        <span className="text-xs font-semibold text-gray-700">
          {formatPercent(val)}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Order Status',
      render: (val) => <Badge status={val || 'confirmed'} />
    },
    {
      key: 'payment_status',
      label: 'Payment',
      render: (val) => <Badge status={val || 'paid'} />
    },
    {
      key: 'sync_status',
      label: 'Sync',
      render: (val) => <Badge status={val || 'synced'} />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Orders Ledger</h2>
          <p className="text-xs text-gray-500">Every multi-channel sales transaction with item cost deduction & profit snapshots</p>
        </div>
        <Button onClick={() => navigate('/orders/create')} className="shadow-xs">
          <Plus className="h-4 w-4" />
          New Order
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by order #, customer name, contact..."
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
          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All Channels</option>
            {channels.map(c => (
              <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All Order Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All Payment Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>

          {/* Date Range */}
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

          {(channelFilter || statusFilter || paymentFilter || startDate || endDate || search) && (
            <button
              onClick={() => {
                setSearch('');
                setChannelFilter('');
                setStatusFilter('');
                setPaymentFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-2 py-1 rounded"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={orders}
          loading={loading}
          emptyMessage="No orders found matching your criteria"
          onRowClick={(row) => navigate(`/orders/${row.id || row._id}`)}
        />

        <div className="p-4 border-t border-gray-100">
          <Pagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={fetchOrders}
          />
        </div>
      </div>
    </div>
  );
}
