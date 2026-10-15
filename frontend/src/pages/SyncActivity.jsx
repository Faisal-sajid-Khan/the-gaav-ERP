import React, { useState, useEffect } from 'react';
import {
  RefreshCw, CheckCircle, AlertTriangle, Clock,
  ArrowRight, ShieldAlert, Play, RotateCw
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Table from '../components/UI/Table';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import EmptyState from '../components/UI/EmptyState';
import { formatDate, formatDateTime } from '../utils/formatters';

export default function SyncActivity() {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [retryingId, setRetryingId] = useState(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sync/jobs').catch(async () => {
        return await api.get('/sync');
      });
      const list = res.data?.data || res.data || [];
      setJobs(Array.isArray(list) ? list : []);
    } catch (err) {
      // Empty sync list gracefully fallback
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleRetryJob = async (jobId) => {
    setRetryingId(jobId);
    try {
      await api.post(`/sync/jobs/${jobId}/retry`);
      addToast('Job queued for immediate re-execution', 'success');
      fetchJobs();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to trigger retry', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleTriggerSyncAll = async () => {
    try {
      await api.post('/sync/trigger');
      addToast('Manual sync triggered for active channels', 'success');
      fetchJobs();
    } catch (err) {
      addToast(err.response?.data?.message || 'Shopify sync will run once credentials are configured in Phase 2', 'info');
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (!statusFilter) return true;
    return job.status?.toLowerCase() === statusFilter.toLowerCase();
  });

  const columns = [
    {
      key: 'job_type',
      label: 'Sync Job Type',
      render: (val, row) => (
        <div>
          <span className="font-semibold text-gray-900 block capitalize">
            {val || row.type || 'Order Ingestion'}
          </span>
          <span className="text-[11px] text-gray-400 font-mono">
            ID: {row.id || row._id || 'N/A'}
          </span>
        </div>
      )
    },
    {
      key: 'reference_id',
      label: 'Target Reference',
      render: (val, row) => (
        <span className="font-mono text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
          {val || row.order_number || row.payload_id || 'System'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <Badge status={val || 'completed'} />
    },
    {
      key: 'attempts',
      label: 'Attempts',
      className: 'text-center',
      render: (val) => <span className="text-xs font-mono text-gray-700">{val || 1} / 3</span>
    },
    {
      key: 'last_error',
      label: 'Last Error Message',
      render: (val) => {
        if (!val) return <span className="text-xs text-gray-400">None</span>;
        return (
          <span className="text-xs text-red-600 truncate max-w-xs block font-mono" title={val}>
            {val}
          </span>
        );
      }
    },
    {
      key: 'created_at',
      label: 'Enqueued At',
      render: (val) => <span className="text-xs text-gray-500 font-mono">{formatDateTime(val)}</span>
    },
    {
      key: 'actions',
      label: 'Action',
      render: (_, row) => {
        const jId = row.id || row._id;
        const isFailed = row.status === 'failed' || row.status === 'error';
        if (!isFailed) return <span className="text-xs text-gray-400">-</span>;
        return (
          <Button
            size="sm"
            variant="secondary"
            loading={retryingId === jId}
            onClick={() => handleRetryJob(jId)}
            className="text-xs py-1"
          >
            <RotateCw className="h-3 w-3" />
            Retry
          </Button>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Background Sync & Integration Queue</h2>
          <p className="text-xs text-gray-500">Monitor webhook ingestion tasks, retry failed sync dispatches, and audit queue health</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchJobs} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleTriggerSyncAll}>
            <Play className="h-3.5 w-3.5" />
            Trigger Sync Now
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-600">Filter Status:</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed / Synced</option>
            <option value="processing">Processing / Running</option>
            <option value="pending">Pending Queue</option>
            <option value="failed">Failed / Error</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          Total Queue Jobs: <span className="font-bold text-gray-900">{filteredJobs.length}</span>
        </div>
      </div>

      {/* Sync Jobs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {filteredJobs.length === 0 && !loading ? (
          <EmptyState
            message="No sync jobs currently in queue. Shopify integration will populate this table once connected in Phase 2."
            icon={RotateCw}
            action={
              <Button size="sm" variant="secondary" onClick={handleTriggerSyncAll}>
                Run Diagnostics
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={filteredJobs}
            loading={loading}
            emptyMessage="No sync jobs found"
          />
        )}
      </div>
    </div>
  );
}
