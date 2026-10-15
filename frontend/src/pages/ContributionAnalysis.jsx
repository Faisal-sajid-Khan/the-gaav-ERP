import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import {
  TrendingUp, DollarSign, Percent, Filter, RefreshCw,
  Layers, ArrowUpRight, Award, PieChart as PieIcon, BarChart2,
  Calendar, Target, Wallet, Activity, ArrowRight, CheckCircle2, Package
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import StatCard from '../components/UI/StatCard';
import Table from '../components/UI/Table';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { formatCurrency, formatPercent, formatDate, formatNumber } from '../utils/formatters';
import { getChannelColor } from './Dashboard';

const CHART_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function ContributionAnalysis() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [channelChartType, setChannelChartType] = useState('pie'); // 'pie' or 'bar'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'monthly'
  const [data, setData] = useState(null);
  const [channels, setChannels] = useState([]);

  // Filters
  const [channelFilter, setChannelFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Default to last 30 days
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);

    api.get('/channels')
      .then(res => setChannels(res.data?.data || res.data || []))
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/contribution', {
        params: {
          channel_id: channelFilter || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        }
      }).catch(async () => {
        return await api.get('/analytics/contribution', {
          params: { channel_id: channelFilter, startDate, endDate, start_date: startDate, end_date: endDate }
        });
      });

      setData(res.data?.data || res.data || {});
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load contribution analysis', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [channelFilter, startDate, endDate]);

  const summary = data?.summary || {
    netSales: data?.netSales ?? data?.totalSales ?? 0,
    totalContribution: data?.totalContribution ?? data?.contribution ?? 0,
    averageMargin: data?.averageMargin ?? data?.margin ?? 0,
    totalOverheads: data?.totalOverheads ?? 0,
    netProfit: data?.netProfit ?? 0,
    breakEvenBars: data?.breakEvenBars ?? null,
    totalBarsSold: data?.totalBarsSold ?? 0
  };

  const channelBreakdown = data?.byChannel || data?.channels || [];
  const topProducts = data?.topProducts || data?.products || [];
  const monthlyBreakdown = data?.monthly || [];
  const drilldownOrders = data?.orders || data?.drilldown || [];

  const formattedChannels = useMemo(() => {
    return (data?.byChannel || data?.channels || []).map(ch => ({
      name: ch.channel_name || ch.name || 'Channel',
      type: (ch.channel_type || ch.type || '').toLowerCase(),
      contribution: parseFloat(ch.contribution) || 0,
      net_sales: parseFloat(ch.net_sales || ch.net_revenue) || 0,
      order_count: parseInt(ch.order_count, 10) || 0,
    }));
  }, [data]);

  const activeChannelsForPie = useMemo(() => {
    const list = formattedChannels.filter(c => c.contribution > 0);
    if (list.length > 0) return list;
    const fallback = formattedChannels.filter(c => c.net_sales > 0);
    if (fallback.length > 0) return fallback;
    return [];
  }, [formattedChannels]);

  const totalPieContribution = useMemo(() => {
    return activeChannelsForPie.reduce((s, c) => s + c.contribution, 0);
  }, [activeChannelsForPie]);

  const formattedTopProducts = useMemo(() => {
    return (data?.topProducts || data?.products || []).map(p => ({
      ...p,
      name: p.product_name || p.name || 'Product',
      variant_name: p.variant_name || '',
      sku: p.sku || '',
      contribution: parseFloat(p.total_contribution ?? p.contribution ?? 0),
      net_sales: parseFloat(p.net_revenue ?? p.total_net_sales ?? p.net_sales ?? 0),
      bars_sold: parseInt(p.total_bars ?? p.units_sold ?? p.quantity ?? 0, 10)
    })).filter(p => p.contribution !== 0 || p.net_sales !== 0);
  }, [data]);

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
      key: 'channel',
      label: 'Channel',
      render: (val, row) => <Badge status={val?.name || row.channel_name || 'Direct'} />
    },
    {
      key: 'bars_sold',
      label: 'Bars',
      className: 'text-center',
      render: (val) => <span className="font-mono text-xs font-semibold text-gray-700">{val || 1}</span>
    },
    {
      key: 'net_sales',
      label: 'Net Revenue',
      className: 'text-right',
      render: (val, row) => <span className="font-semibold text-gray-900">{formatCurrency(val ?? row.total_amount)}</span>
    },
    {
      key: 'cogs',
      label: 'COGS',
      className: 'text-right',
      render: (val, row) => <span className="text-gray-600 font-mono">- {formatCurrency(val ?? row.total_cogs ?? 0)}</span>
    },
    {
      key: 'channel_fee',
      label: 'Channel Fee',
      className: 'text-right',
      render: (val) => <span className="text-gray-600 font-mono">- {formatCurrency(val || 0)}</span>
    },
    {
      key: 'shipping_cost',
      label: 'Courier',
      className: 'text-right',
      render: (val, row) => <span className="text-gray-600 font-mono">- {formatCurrency(val ?? row.actual_shipping_cost ?? 0)}</span>
    },
    {
      key: 'contribution',
      label: 'Contribution',
      className: 'text-right',
      render: (val, row) => {
        const num = parseFloat(val ?? row.contribution_amount) || 0;
        return (
          <span className={`font-bold font-mono ${num >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(num)}
          </span>
        );
      }
    },
    {
      key: 'contribution_margin_pct',
      label: 'Margin %',
      className: 'text-right',
      render: (val, row) => <span className="text-xs font-semibold text-gray-700">{formatPercent(val ?? row.contribution_margin)}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-primary-100 text-primary-800">
              Phase 1 MVP Unit-Economics
            </span>
            <h2 className="text-lg font-bold text-gray-900">Contribution & Profitability Analysis</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Automatic unit economics per sale (Formulas 1–10), channel/product aggregation, and net profit after overheads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/expenses')}>
            <Wallet className="h-3.5 w-3.5 text-gray-500" />
            Manage Overheads
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchData} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar & Tab Selector */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All Channels</option>
            {channels.map(c => (
              <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
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

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'overview' ? 'bg-white shadow-2xs text-primary-700 font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Channel & Product
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'monthly' ? 'bg-white shadow-2xs text-primary-700 font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Monthly (Formula 13)
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (6 Metric Cards: Direct Contribution + Net Profit & Break-Even) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Row 1: Direct Unit Economics */}
        <StatCard
          title="Net Revenue (Formula 6)"
          value={formatCurrency(summary.netSales)}
          subtitle="Net billed minus applicable tax"
          icon={TrendingUp}
          color="green"
          loading={loading}
        />
        <StatCard
          title="Total Contribution (Formula 9)"
          value={formatCurrency(summary.totalContribution)}
          subtitle="Net revenue − Channel costs − COGS"
          icon={DollarSign}
          color="purple"
          loading={loading}
        />
        <StatCard
          title="Contribution Margin (Formula 10)"
          value={formatPercent(summary.averageMargin)}
          subtitle="Weighted margin = Contribution ÷ Revenue"
          icon={Percent}
          color="blue"
          loading={loading}
        />

        {/* Row 2: Master Economics (Formulas 14 & 15) */}
        <StatCard
          title="Period Overheads"
          value={formatCurrency(summary.totalOverheads)}
          subtitle="Excludes direct manufacturing COGS"
          icon={Wallet}
          color="amber"
          loading={loading}
        />
        <StatCard
          title="Net Profit (Formula 14)"
          value={formatCurrency(summary.netProfit)}
          subtitle="Total contribution − Period overheads"
          icon={Activity}
          color={summary.netProfit >= 0 ? 'emerald' : 'red'}
          loading={loading}
        />
        <StatCard
          title="Break-Even Volume (Formula 15)"
          value={summary.breakEvenBars !== null ? `${formatNumber(summary.breakEvenBars)} bars` : (summary.totalOverheads === 0 ? '0 bars' : 'Need sales data')}
          subtitle={`Overheads ÷ Unit contribution (${summary.totalBarsSold || 0} bars sold)`}
          icon={Target}
          color="indigo"
          loading={loading}
        />
      </div>

      {/* Charts Section: Overview (Channel & Product) or Monthly (Formula 13) */}
      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Channel Contribution Comparison */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-gray-900">Channel Contribution Comparison</h3>
                <p className="text-xs text-gray-500">Net contribution profit generated by each channel</p>
              </div>
              <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setChannelChartType('pie')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                    channelChartType === 'pie' ? 'bg-white shadow-2xs text-primary-700 font-bold' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <PieIcon className="h-3 w-3" />
                  Pie
                </button>
                <button
                  type="button"
                  onClick={() => setChannelChartType('bar')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                    channelChartType === 'bar' ? 'bg-white shadow-2xs text-primary-700 font-bold' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <BarChart2 className="h-3 w-3" />
                  Bar
                </button>
              </div>
            </div>

            <div className="h-64 w-full relative mt-2 flex items-center justify-center">
              {loading ? (
                <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
              ) : formattedChannels.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  No channel data in selected date range
                </div>
              ) : channelChartType === 'pie' ? (
                activeChannelsForPie.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                    <PieIcon className="h-8 w-8 text-gray-300 mb-2 stroke-[1.5]" />
                    <span>No channel contribution in selected period</span>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={activeChannelsForPie}
                          dataKey="contribution"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={activeChannelsForPie.length > 1 ? 4 : 0}
                          isAnimationActive={false}
                        >
                          {activeChannelsForPie.map((entry, index) => {
                            return <Cell key={`cell-${index}`} fill={getChannelColor(entry.name, entry.type)} stroke="#ffffff" strokeWidth={2} />;
                          })}
                        </Pie>
                        <Tooltip
                          formatter={(val) => {
                            const total = totalPieContribution;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return [`${formatCurrency(val)} (${pct}%)`, 'Contribution'];
                          }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Total Profit</span>
                      <span className="text-sm font-black font-mono text-gray-900 leading-tight">
                        {formatCurrency(summary.totalContribution)}
                      </span>
                    </div>
                  </>
                )
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedChannels} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={val => `₹${(val / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val) => [formatCurrency(val), 'Contribution']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="contribution" radius={[4, 4, 0, 0]}>
                      {formattedChannels.map((entry, i) => (
                        <Cell key={i} fill={getChannelColor(entry.name, entry.type)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Breakdown Pills */}
            <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto">
              {formattedChannels.map(ch => {
                const color = getChannelColor(ch.name, ch.type);
                return (
                  <div key={ch.name} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-[11px]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-medium text-gray-700">{ch.name}:</span>
                    <span className="font-bold font-mono text-gray-900">{formatCurrency(ch.contribution)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 10 Products by Contribution */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col">
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900">Top 10 Products by Contribution</h3>
              <p className="text-xs text-gray-500">Products that produce the greatest net profits</p>
            </div>

            <div className="h-72 w-full mt-2">
              {loading ? (
                <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
              ) : formattedTopProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-gray-400">
                  <Package className="h-8 w-8 text-gray-300 mb-2 stroke-[1.5]" />
                  <span>No product contribution data available</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedTopProducts.slice(0, 10)} layout="vertical" margin={{ top: 10, right: 25, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={val => `₹${val}`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#1e293b' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(val) => [formatCurrency(val), 'Contribution Profit']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="contribution" fill="#10b981" radius={[0, 4, 4, 0]}>
                      {formattedTopProducts.slice(0, 10).map((entry, i) => (
                        <Cell key={i} fill={entry.contribution >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Formula 13: By Month Aggregation */
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary-600" />
                  Monthly Margin Velocity (Formula 13)
                </h3>
                <p className="text-xs text-gray-500">
                  Weighted margin for the month: <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] font-mono text-gray-800">total_contribution ÷ net_revenue</code>
                </p>
              </div>
            </div>

            {monthlyBreakdown.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No monthly data recorded yet for the selected period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Calendar Month</th>
                      <th className="py-3 px-4 text-center">Orders</th>
                      <th className="py-3 px-4 text-center">Bars Sold</th>
                      <th className="py-3 px-4 text-right">Net Revenue</th>
                      <th className="py-3 px-4 text-right">Contribution</th>
                      <th className="py-3 px-4 text-right">Weighted Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {monthlyBreakdown.map((row, idx) => {
                      const marginNum = parseFloat(row.margin_pct) || 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary-600" />
                            {row.month}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-gray-600">{row.order_count}</td>
                          <td className="py-3 px-4 text-center font-mono font-semibold text-gray-900">{row.total_bars}</td>
                          <td className="py-3 px-4 text-right font-mono text-gray-900">{formatCurrency(row.net_revenue)}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                            {formatCurrency(row.contribution)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-xs ${
                              marginNum >= 40 ? 'bg-emerald-100 text-emerald-800' : marginNum >= 20 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {formatPercent(marginNum)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders Drilldown Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Transaction Drilldown Ledger</h3>
            <p className="text-xs text-gray-500">Inspect contribution margin line by line for every individual order</p>
          </div>
        </div>

        <Table
          columns={columns}
          data={drilldownOrders}
          loading={loading}
          emptyMessage="No orders found for this analysis window"
          onRowClick={(row) => navigate(`/orders/${row.id || row._id}`)}
        />
      </div>
    </div>
  );
}
