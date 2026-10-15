import React, { useState, useEffect } from 'react';
import {
  FileText, Search, Eye, Filter, RefreshCw, Calendar,
  Shield, Code, ArrowRight
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Table from '../components/UI/Table';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import Pagination from '../components/UI/Pagination';
import { formatDateTime } from '../utils/formatters';

export default function AuditLogs() {
  const { addToast } = useToast();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  // Inspector Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        search: search || undefined,
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
      };

      const res = await api.get('/audit-logs', { params }).catch(async () => {
        return await api.get('/audit', { params });
      });

      const list = res.data?.data || res.data || [];
      setLogs(Array.isArray(list) ? list : []);

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
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [actionFilter, entityFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Timestamp',
      render: (val, row) => (
        <span className="text-xs text-gray-500 font-mono">
          {formatDateTime(val || row.timestamp)}
        </span>
      )
    },
    {
      key: 'user',
      label: 'User / Actor',
      render: (val, row) => {
        const name = val?.name || row.user_name || row.actor || 'System Bot';
        const email = val?.email || row.user_email || '';
        return (
          <div>
            <span className="font-semibold text-gray-900 block">{name}</span>
            {email && <span className="text-[11px] text-gray-400 font-mono">{email}</span>}
          </div>
        );
      }
    },
    {
      key: 'action',
      label: 'Action',
      render: (val) => {
        const actionStr = (val || 'update').toLowerCase();
        let variant = 'neutral';
        if (actionStr.includes('create') || actionStr.includes('insert')) variant = 'success';
        if (actionStr.includes('delete') || actionStr.includes('cancel')) variant = 'error';
        if (actionStr.includes('update') || actionStr.includes('adjust')) variant = 'warning';
        return <Badge status={actionStr} variant={variant} />;
      }
    },
    {
      key: 'entity',
      label: 'Entity / Domain',
      render: (val, row) => (
        <span className="text-xs font-semibold text-gray-700 uppercase bg-gray-100 px-2 py-0.5 rounded">
          {val || row.entity_type || 'General'}
        </span>
      )
    },
    {
      key: 'entity_id',
      label: 'Entity ID / Ref',
      render: (val) => (
        <span className="font-mono text-xs text-primary-600">
          {val || 'N/A'}
        </span>
      )
    },
    {
      key: 'ip_address',
      label: 'IP / Origin',
      render: (val) => <span className="font-mono text-xs text-gray-400">{val || '127.0.0.1'}</span>
    },
    {
      key: 'actions',
      label: 'Inspect',
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(row);
          }}
          className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-gray-100 transition-colors"
          title="Inspect Diff"
        >
          <Eye className="h-4 w-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Security & System Audit Trail</h2>
          <p className="text-xs text-gray-500">Immutable ledger of state alterations across catalog, inventory, and orders</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => fetchLogs(1)} loading={loading}>
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
              placeholder="Search by actor, entity ID, or notes..."
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
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete / Cancel</option>
            <option value="adjust">Stock Adjust</option>
          </select>

          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All Entities</option>
            <option value="orders">Orders</option>
            <option value="products">Products</option>
            <option value="inventory">Inventory</option>
            <option value="channels">Channels</option>
            <option value="settings">Settings</option>
          </select>

          {(actionFilter || entityFilter || search) && (
            <button
              onClick={() => {
                setSearch('');
                setActionFilter('');
                setEntityFilter('');
              }}
              className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-2 py-1 rounded"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={logs}
          loading={loading}
          emptyMessage="No audit logs recorded matching filters"
          onRowClick={(row) => setSelectedLog(row)}
        />

        <div className="p-4 border-t border-gray-100">
          <Pagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={fetchLogs}
          />
        </div>
      </div>

      {/* Audit Diff Inspector Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Log State Inspector"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setSelectedLog(null)}>
            Close
          </Button>
        }
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border">
              <div>
                <span className="text-gray-400 block">Actor:</span>
                <span className="font-semibold text-gray-800">
                  {selectedLog.user?.name || selectedLog.user_name || 'System'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">Action & Entity:</span>
                <span className="font-semibold text-gray-800 uppercase">
                  {selectedLog.action} on {selectedLog.entity || 'Record'} ({selectedLog.entity_id})
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-gray-700 block flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5 text-primary-600" />
                State Mutation Payload / Diff
              </span>
              <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed max-h-72">
                {JSON.stringify(selectedLog.details || selectedLog.changes || selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
