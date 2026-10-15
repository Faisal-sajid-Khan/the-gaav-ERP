'use strict';
const model = require('./dashboardModel');
const expenseModel = require('../expenses/expenseModel');
const { success } = require('../../utils/responseHelper');

const getSummary = async (req, res, next) => {
  try {
    const start_date = req.query.start_date || req.query.startDate;
    const end_date = req.query.end_date || req.query.endDate;
    const channel_id = req.query.channel_id || req.query.channelId;
    const [kpis, trend, channels, topProducts, recentOrders, monthly, overheadsData] = await Promise.all([
      model.getKPIs({ start_date, end_date, channel_id }),
      model.getSalesTrend({ start_date, end_date, channel_id }),
      model.getChannelBreakdown({ start_date, end_date }),
      model.getTopProducts({ limit: 10, start_date, end_date }),
      model.getRecentOrders({ limit: 6 }),
      model.getMonthlyBreakdown({ start_date, end_date }),
      expenseModel.getPeriodOverheads({ start_date, end_date })
    ]);

    const totalOrdersCount = Number(kpis?.orders?.total_orders || 0);
    const netSalesAmount = Number(kpis?.orders?.total_net_sales || 0);
    const netRevenueAmount = Number(kpis?.orders?.total_net_revenue || netSalesAmount);
    const totalContribution = Number(kpis?.orders?.total_contribution || 0);
    const totalBarsSold = Number(kpis?.orders?.total_bars_sold || topProducts?.reduce((sum, p) => sum + Number(p.total_bars || p.units_sold || 0), 0) || 0);
    const totalOverheads = Number(overheadsData?.totalOverheads || 0);

    // Formula 14: Net profit = total_contribution - total_overheads
    const netProfit = totalContribution - totalOverheads;

    // Formula 15: Break-even volume
    // break_even_bars = period_overheads ÷ (total_contribution ÷ total_bars)
    // Returns null when no bars have been sold or unit contribution <= 0
    let breakEvenBars = null;
    if (totalBarsSold > 0 && totalContribution > 0 && totalOverheads > 0) {
      const unitContribution = totalContribution / totalBarsSold;
      breakEvenBars = Math.ceil(totalOverheads / unitContribution);
    }

    const stats = {
      totalOrders: totalOrdersCount,
      netSales: netRevenueAmount,
      aov: totalOrdersCount > 0 ? Number((netRevenueAmount / totalOrdersCount).toFixed(2)) : 0,
      totalContribution,
      contributionMargin: Number(kpis?.orders?.avg_contribution_margin_pct || 0),
      totalDiscounts: Number(kpis?.orders?.total_discounts || 0),
      unitsSold: Number(topProducts?.reduce((sum, p) => sum + Number(p.units_sold || 0), 0) || 0),
      totalBarsSold,
      unitsInStock: Number(kpis?.inventory?.total_units_in_stock || 0),
      lowStockCount: Number(kpis?.inventory?.low_stock_count || 0),
      totalOverheads,
      netProfit,
      breakEvenBars,
      ordersTrend: 0,
      salesTrend: 0,
      contributionTrend: 0,
    };

    const summary = {
      netSales: netRevenueAmount,
      totalContribution,
      averageMargin: Number(kpis?.orders?.avg_contribution_margin_pct || 0),
      totalOverheads,
      netProfit,
      breakEvenBars,
      totalBarsSold
    };

    const formattedChannels = (channels || []).map(ch => ({
      ...ch,
      id: ch.channel_id || ch.id,
      name: ch.channel_name || ch.name,
      channel_name: ch.channel_name || ch.name,
      channel_type: (ch.channel_type || ch.type || '').toLowerCase(),
      type: (ch.channel_type || ch.type || '').toLowerCase(),
      order_count: parseInt(ch.order_count, 10) || 0,
      total_bars: parseInt(ch.total_bars, 10) || 0,
      net_sales: parseFloat(ch.net_sales) || 0,
      net_revenue: parseFloat(ch.net_revenue || ch.net_sales) || 0,
      contribution: parseFloat(ch.contribution) || 0,
      margin_pct: parseFloat(ch.margin_pct) || 0
    }));

    const formattedProducts = (topProducts || []).map(p => ({
      ...p,
      id: p.product_id || p.id,
      name: p.product_name || p.name,
      product_name: p.product_name || p.name,
      variant_name: p.variant_name || '',
      sku: p.sku || '',
      total_bars: parseInt(p.total_bars, 10) || 0,
      units_sold: parseInt(p.units_sold || p.total_bars, 10) || 0,
      net_sales: parseFloat(p.net_revenue || p.total_net_sales) || 0,
      net_revenue: parseFloat(p.net_revenue || p.total_net_sales) || 0,
      contribution: parseFloat(p.total_contribution ?? p.contribution ?? 0),
      total_contribution: parseFloat(p.total_contribution ?? p.contribution ?? 0),
      contribution_margin_pct: parseFloat(p.contribution_margin_pct) || 0
    }));

    return success(res, {
      kpis,
      trend,
      channels: formattedChannels,
      topProducts: formattedProducts,
      recentOrders,
      monthly,
      overheads: overheadsData,
      stats,
      summary,
      salesByDay: trend,
      contributionByChannel: formattedChannels,
      contributionByProduct: formattedProducts,
      byChannel: formattedChannels,
      products: formattedProducts,
      orders: recentOrders
    });
  } catch (err) { next(err); }
};

const getTrend = async (req, res, next) => {
  try {
    const start_date = req.query.start_date || req.query.startDate;
    const end_date = req.query.end_date || req.query.endDate;
    const channel_id = req.query.channel_id || req.query.channelId;
    const trend = await model.getSalesTrend({ start_date, end_date, channel_id });
    return success(res, trend);
  } catch (err) { next(err); }
};

const getChannelPerformance = async (req, res, next) => {
  try {
    const start_date = req.query.start_date || req.query.startDate;
    const end_date = req.query.end_date || req.query.endDate;
    const breakdown = await model.getChannelBreakdown({ start_date, end_date });
    return success(res, breakdown);
  } catch (err) { next(err); }
};

const getTopContributionProducts = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const start_date = req.query.start_date || req.query.startDate;
    const end_date = req.query.end_date || req.query.endDate;
    const products = await model.getTopProducts({ limit, start_date, end_date });
    return success(res, products);
  } catch (err) { next(err); }
};

module.exports = {
  getSummary,
  getTrend,
  getChannelPerformance,
  getTopContributionProducts
};
