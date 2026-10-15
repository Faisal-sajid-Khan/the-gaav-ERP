import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  ShoppingCart, TrendingUp, DollarSign, Percent, Package,
  AlertTriangle, RefreshCw, ArrowUpRight, Calendar, Filter,
  PieChart as PieIcon, Coins, Tag, Boxes, Target, ArrowRight,
  Wallet, Activity
} from 'lucide-react';
import api from '../api/axios';
import StatCard from '../components/UI/StatCard';
import Badge from '../components/UI/Badge';
import Button from '../components/UI/Button';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { formatCurrency, formatNumber, formatDate, formatPercent } from '../utils/formatters';

export const getChannelColor = (name = '', type = '') => {
  const key = `${name} ${type}`.toLowerCase();
  if (key.includes('whatsapp')) return '#25D366'; // WhatsApp signature green
  if (key.includes('shopify')) return '#7C3AED'; // Shopify signature vivid purple
  if (key.includes('instagram')) return '#E1306C'; // Instagram pink/magenta
  if (key.includes('offline') || key.includes('retail') || key.includes('direct') || key.includes('walk-in') || key.includes('store')) return '#3B82F6'; // Electric Blue
  if (key.includes('distributor') || key.includes('b2b') || key.includes('wholesale')) return '#F59E0B'; // Amber/Gold
  if (key.includes('phone') || key.includes('call')) return '#06B6D4'; // Cyan
  return '#10B981'; // Emerald fallback
};

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [channelMetric, setChannelMetric] = useState('contribution'); // 'contribution' or 'net_sales'

  // Initialize dates
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    if (period === '7d') start.setDate(end.getDate() - 7);
    else if (period === '30d') start.setDate(end.getDate() - 30);
    else if (period === '90d') start.setDate(end.getDate() - 90);
    else if (period === 'month') start.setDate(1);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, [period]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/dashboard', {
        params: { startDate, endDate, start_date: startDate, end_date: endDate, period }
      }).catch(async () => {
        // Fallback to contribution summary if analytics endpoint is named differently
        return await api.get('/contribution/summary', { params: { startDate, endDate, start_date: startDate, end_date: endDate } });
      });

      const payload = res?.data?.data || res?.data || {};
      setData(payload);
    } catch {
      // Provide clean default fallback structure if backend is not yet populated
      setData(prev => prev || {
        stats: {
          totalOrders: 0,
          netSales: 0,
          totalContribution: 0,
          contributionMargin: 0,
          unitsSold: 0,
          lowStockCount: 0,
          ordersTrend: 0,
          salesTrend: 0,
          contributionTrend: 0,
        },
        salesByDay: [],
        contributionByChannel: [],
        contributionByProduct: [],
        recentOrders: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchDashboardData();
    }
  }, [startDate, endDate]);

  const rawOrders = data?.kpis?.orders || {};
  const rawInventory = data?.kpis?.inventory || {};

  const stats = data?.stats || {
    totalOrders: data?.totalOrders ?? Number(rawOrders.total_orders || 0),
    netSales: data?.netSales ?? Number(rawOrders.total_net_sales || 0),
    aov: data?.aov ?? 0,
    totalContribution: data?.totalContribution ?? Number(rawOrders.total_contribution || 0),
    contributionMargin: data?.contributionMargin ?? Number(rawOrders.avg_contribution_margin_pct || 0),
    totalDiscounts: data?.totalDiscounts ?? Number(rawOrders.total_discounts || 0),
    unitsSold: data?.unitsSold ?? (data?.topProducts?.reduce((s, p) => s + Number(p.units_sold || 0), 0) || 0),
    totalBarsSold: data?.totalBarsSold ?? Number(rawOrders.total_bars_sold || 0),
    unitsInStock: data?.unitsInStock ?? Number(rawInventory.total_units_in_stock || 0),
    lowStockCount: data?.lowStockCount ?? Number(rawInventory.low_stock_count || 0),
    totalOverheads: data?.totalOverheads ?? Number(data?.summary?.totalOverheads || 0),
    netProfit: data?.netProfit ?? Number(data?.summary?.netProfit || 0),
    breakEvenBars: data?.breakEvenBars ?? data?.summary?.breakEvenBars ?? null,
    ordersTrend: data?.ordersTrend ?? 0,
    salesTrend: data?.salesTrend ?? 0,
    contributionTrend: data?.contributionTrend ?? 0,
  };

  // Safe defaults if API response didn't calculate some fields
  if (stats.aov === undefined || stats.aov === null || stats.aov === 0) {
    stats.aov = stats.totalOrders > 0 ? Number((stats.netSales / stats.totalOrders).toFixed(2)) : 0;
  }
  if (stats.totalDiscounts === undefined || stats.totalDiscounts === null) {
    stats.totalDiscounts = Number(rawOrders.total_discounts || 0);
  }
  if (stats.unitsInStock === undefined || stats.unitsInStock === null || stats.unitsInStock === 0) {
    stats.unitsInStock = Number(rawInventory.total_units_in_stock || 0);
  }

  const salesTrend = data?.salesByDay || data?.dailySales || [];
  const channelData = data?.contributionByChannel || data?.channels || [];
  const productData = data?.contributionByProduct || data?.products || [];
  const recentOrders = data?.recentOrders || [];

  const formattedChannelData = useMemo(() => {
    return (channelData || []).map(ch => ({
      name: ch.name || ch.channel_name || 'Channel',
      type: (ch.type || ch.channel_type || '').toLowerCase(),
      contribution: parseFloat(ch.contribution) || 0,
      net_sales: parseFloat(ch.net_sales) || 0,
      order_count: parseInt(ch.order_count, 10) || 0,
    }));
  }, [channelData]);

  const totalChannelMetric = useMemo(() => {
    return formattedChannelData.reduce((acc, c) => acc + (c[channelMetric] > 0 ? c[channelMetric] : 0), 0);
  }, [formattedChannelData, channelMetric]);

  const activeChannelsForPie = useMemo(() => {
    const list = formattedChannelData.filter(c => c[channelMetric] > 0);
    if (list.length > 0) return list;
    const fallbackList = formattedChannelData.filter(c => c.net_sales > 0);
    if (fallbackList.length > 0) return fallbackList;
    return [];
  }, [formattedChannelData, channelMetric]);

  return (
    <div className="space-y-6">
      {/* Top Bar with Date Filters & Refresh */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Executive Summary</h2>
          <p className="text-xs text-gray-500">Real-time revenue, margins, and operational inventory health</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1.5 rounded-md transition-all ${period === '7d' ? 'bg-white shadow-xs text-primary-700 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
            >
              7 Days
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1.5 rounded-md transition-all ${period === '30d' ? 'bg-white shadow-xs text-primary-700 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
            >
              30 Days
            </button>
            <button
              onClick={() => setPeriod('90d')}
              className={`px-3 py-1.5 rounded-md transition-all ${period === '90d' ? 'bg-white shadow-xs text-primary-700 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
            >
              90 Days
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1.5 rounded-md transition-all ${period === 'custom' ? 'bg-white shadow-xs text-primary-700 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Custom
            </button>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent border-0 text-xs text-gray-700 focus:ring-0"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent border-0 text-xs text-gray-700 focus:ring-0"
              />
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDashboardData}
            loading={loading}
            className="text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </Button>
        </div>
      </div>

      {/* 3 by 3 Grid: 9 Key Performance Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Row 1: Order Velocity & Revenue */}
        <StatCard
          title="Total Orders"
          value={formatNumber(stats.totalOrders)}
          subtitle="Processed customer orders"
          icon={ShoppingCart}
          color="primary"
          trend={stats.ordersTrend}
          loading={loading}
        />
        <StatCard
          title="Net Sales"
          value={formatCurrency(stats.netSales)}
          subtitle="Gross sales minus discounts"
          icon={TrendingUp}
          color="green"
          trend={stats.salesTrend}
          loading={loading}
        />
        <StatCard
          title="Average Order Value (AOV)"
          value={formatCurrency(stats.aov)}
          subtitle="Average net revenue per order"
          icon={Coins}
          color="indigo"
          loading={loading}
        />

        {/* Row 2: Profitability, Margins & Discounts */}
        <StatCard
          title="Total Contribution"
          value={formatCurrency(stats.totalContribution)}
          subtitle="Sales - COGS - Channel fees"
          icon={DollarSign}
          color="purple"
          trend={stats.contributionTrend}
          loading={loading}
        />
        <StatCard
          title="Contribution Margin"
          value={formatPercent(stats.contributionMargin)}
          subtitle="Gross profitability efficiency"
          icon={Percent}
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Total Discounts"
          value={formatCurrency(stats.totalDiscounts)}
          subtitle="Promotional coupon deductions"
          icon={Tag}
          color="amber"
          loading={loading}
        />

        {/* Row 3: Operational Stock & Fulfillment */}
        <StatCard
          title="Units Sold"
          value={formatNumber(stats.unitsSold)}
          subtitle="Total product units ordered"
          icon={Package}
          color="emerald"
          loading={loading}
        />
        <StatCard
          title="Units In Stock"
          value={formatNumber(stats.unitsInStock)}
          subtitle="Live central inventory on-hand"
          icon={Boxes}
          color="cyan"
          loading={loading}
        />
        <StatCard
          title="Low Stock SKUs"
          value={formatNumber(stats.lowStockCount)}
          subtitle="SKUs at or below reorder limit"
          icon={AlertTriangle}
          color="red"
          loading={loading}
        />
      </div>

      {/* Phase 1 MVP: Net Profit & Break-Even Volume (Formulas 14 & 15) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-5 text-white shadow-md border border-indigo-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-800/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Phase 1 MVP Unit-Economics
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Net Profit & Break-Even Volume
              </h3>
            </div>
            <p className="text-xs text-indigo-200/80 mt-1">
              Contribution after central operating overheads and period production volume thresholds
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/expenses')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 border border-white/10"
            >
              <Wallet className="w-3.5 h-3.5 text-indigo-300" />
              Manage Overheads
            </button>
            <button
              onClick={() => navigate('/contribution')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-xs"
            >
              Unit Economics
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
          {/* Card 1: Net Profit (Formula 14) */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-indigo-200 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  Net Profit (Formula 14)
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  stats.netProfit >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {stats.totalOverheads === 0 ? 'No Overheads Logged' : stats.netProfit >= 0 ? 'Profitable' : 'Deficit'}
                </span>
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-white mt-2">
                {formatCurrency(stats.netProfit)}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 text-xs text-indigo-200/80 flex items-center justify-between">
              <span>Contribution: <strong className="text-white">{formatCurrency(stats.totalContribution)}</strong></span>
              <span className="text-indigo-400">−</span>
              <span>Overheads: <strong className="text-rose-300">{formatCurrency(stats.totalOverheads)}</strong></span>
            </div>
          </div>

          {/* Card 2: Break-Even Volume (Formula 15) */}
          <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-indigo-200 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  Break-Even Volume (Formula 15)
                </span>
                <span className="text-[11px] font-mono text-indigo-300">
                  {stats.totalBarsSold} bars sold
                </span>
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-white mt-2">
                {stats.breakEvenBars !== null ? `${formatNumber(stats.breakEvenBars)} bars` : (stats.totalOverheads === 0 ? '0 bars (no overheads)' : 'Need sales to calculate')}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10">
              {stats.breakEvenBars !== null && stats.breakEvenBars > 0 ? (
                <div>
                  <div className="flex justify-between text-xs text-indigo-200/80 mb-1">
                    <span>Break-even progress</span>
                    <span className="font-semibold text-white">
                      {Math.min(100, Math.round((stats.totalBarsSold / stats.breakEvenBars) * 100))}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.totalBarsSold >= stats.breakEvenBars ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, (stats.totalBarsSold / stats.breakEvenBars) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-indigo-200/70">
                  Formula: <span className="font-mono text-indigo-300">period_overheads ÷ (total_contribution ÷ total_bars)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Net Sales Over Time - Area Chart (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Revenue Velocity</h3>
              <p className="text-xs text-gray-500">Daily net sales across all active channels</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full">
              INR (₹)
            </span>
          </div>

          <div className="h-72 w-full mt-2">
            {loading ? (
              <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
            ) : salesTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                No revenue records in selected date range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={val => val ? val.slice(5) : ''}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={val => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), 'Net Sales']}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#salesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Channel Contribution - Modern Pie/Donut Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">Channel Contribution</h3>
              <p className="text-xs text-gray-500">Profitability contribution per channel</p>
            </div>
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setChannelMetric('contribution')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  channelMetric === 'contribution' ? 'bg-white shadow-2xs text-primary-700 font-bold' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Profit
              </button>
              <button
                type="button"
                onClick={() => setChannelMetric('net_sales')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  channelMetric === 'net_sales' ? 'bg-white shadow-2xs text-primary-700 font-bold' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Revenue
              </button>
            </div>
          </div>

          <div className="h-56 w-full relative mt-1 flex items-center justify-center">
            {loading ? (
              <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
            ) : activeChannelsForPie.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                  <PieIcon className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-xs font-semibold text-gray-600">No channel sales in period</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Orders from WhatsApp, Shopify, etc. will show here</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activeChannelsForPie}
                      dataKey={channelMetric}
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={activeChannelsForPie.length > 1 ? 4 : 0}
                    >
                      {activeChannelsForPie.map((entry, index) => {
                        const color = getChannelColor(entry.name, entry.type);
                        return <Cell key={`cell-${index}`} fill={color} stroke="#ffffff" strokeWidth={2} />;
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(val, name, item) => {
                        const pct = totalChannelMetric > 0 ? ((val / totalChannelMetric) * 100).toFixed(1) : 0;
                        return [`${formatCurrency(val)} (${pct}%)`, `${channelMetric === 'contribution' ? 'Contribution' : 'Net Sales'}`];
                      }}
                      labelFormatter={label => `Channel: ${label}`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400">Total</span>
                  <span className="text-sm font-black font-mono text-gray-900 leading-tight">
                    {formatCurrency(totalChannelMetric)}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {activeChannelsForPie.length} {activeChannelsForPie.length === 1 ? 'channel' : 'channels'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Channel Legend with Colors, Channel Names, Values and Percentages */}
          <div className="mt-2 pt-2.5 border-t border-gray-100 space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {formattedChannelData.map(ch => {
              const color = getChannelColor(ch.name, ch.type);
              const val = ch[channelMetric] || 0;
              const pct = totalChannelMetric > 0 ? ((val / totalChannelMetric) * 100).toFixed(1) : 0;
              const hasSales = val > 0;

              return (
                <div
                  key={ch.name}
                  className={`flex items-center justify-between text-xs py-1 px-1.5 rounded-lg transition-colors ${
                    hasSales ? 'hover:bg-gray-50 text-gray-800' : 'text-gray-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: color }} />
                    <span className="font-semibold truncate">{ch.name}</span>
                    <span className="text-[10px] text-gray-400 capitalize">({ch.type || 'direct'})</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-gray-900">{formatCurrency(val)}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 font-mono">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Secondary Row: Product Contribution Pie & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products Contribution Pie Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Contribution by Product</h3>
              <p className="text-xs text-gray-500">Distribution among leading items</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
            ) : productData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                No product distribution data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productData}
                    dataKey="contribution"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {productData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), 'Contribution']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Orders Table Snapshot */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Recent Customer Orders</h3>
              <p className="text-xs text-gray-500">Latest transactions with contribution metrics</p>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View All Orders <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3 text-right">Net Sales</th>
                  <th className="py-2.5 px-3 text-right">Contribution</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-400">
                      No recent orders recorded
                    </td>
                  </tr>
                ) : (
                  recentOrders.slice(0, 6).map((ord) => (
                    <tr
                      key={ord.id || ord.order_number}
                      onClick={() => navigate(`/orders/${ord.id || ord._id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-semibold text-primary-600">
                        {ord.order_number || `#${ord.id}`}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{formatDate(ord.order_date || ord.created_at)}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{ord.customer_name || 'Walk-in'}</td>
                      <td className="py-2.5 px-3">
                        <Badge status={ord.channel?.name || ord.channel_type || 'offline'} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-gray-900">
                        {formatCurrency(ord.net_sales || ord.total_amount)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-semibold ${
                        (ord.contribution_amount ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(ord.contribution_amount || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge status={ord.status || 'confirmed'} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
