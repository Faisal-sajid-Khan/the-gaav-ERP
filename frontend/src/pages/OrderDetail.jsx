import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RotateCcw, Ban, CheckCircle, Calculator,
  Truck, User, Calendar, DollarSign, Receipt, AlertTriangle
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { formatCurrency, formatPercent, formatDate, formatDateTime } from '../utils/formatters';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cancel Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Refund Modal
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [restockItems, setRestockItems] = useState(true);
  const [refunding, setRefunding] = useState(false);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data?.data || res.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load order', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchOrder();
  }, [id]);

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      await api.post(`/orders/${id}/cancel`, { reason: cancelReason });
      addToast('Order cancelled successfully', 'success');
      setIsCancelModalOpen(false);
      fetchOrder();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to cancel order', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleAddRefund = async (e) => {
    e.preventDefault();
    setRefunding(true);
    try {
      await api.post(`/orders/${id}/refund`, {
        amount: parseFloat(refundAmount) || 0,
        reason: refundReason,
        restock_items: restockItems,
      });
      addToast('Refund recorded and stock adjusted', 'success');
      setIsRefundModalOpen(false);
      setRefundAmount('');
      setRefundReason('');
      fetchOrder();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to process refund', 'error');
    } finally {
      setRefunding(false);
    }
  };

  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await api.post(`/orders/${id}/recalculate`);
      addToast('Order unit economics recalculated with latest costs and settings', 'success');
      fetchOrder();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to recalculate order', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Order record not found</p>
        <Button onClick={() => navigate('/orders')}>Return to Orders</Button>
      </div>
    );
  }

  const items = order.items || order.order_items || [];
  const refunds = order.refunds || [];

  const netSales = parseFloat(order.net_revenue ?? order.net_sales ?? order.total_amount) || 0;
  const cogs = parseFloat(order.cogs_total ?? order.total_cogs ?? order.cogs_amount) || 0;
  const channelFee = parseFloat(order.channel_cost_total ?? order.channel_fee ?? order.commission_amount) || 0;
  const courierCost = parseFloat(order.actual_shipping_expense ?? order.actual_shipping_cost ?? order.shipping_cost) || 0;
  const pgFee = parseFloat(order.gateway_fee ?? order.pg_fee) || 0;
  const otherCost = parseFloat(order.other_direct_cost ?? order.other_expenses) || 0;

  // Formula 7 & 8: Total direct costs = COGS + Channel Costs (channel cost already includes courier + gateway + commission)
  const totalDirectCosts = cogs + channelFee;
  const contribution = parseFloat(order.contribution !== undefined ? order.contribution : (netSales - totalDirectCosts)) || 0;
  const marginPercent = netSales > 0 ? (contribution / netSales) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Back button and quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/orders')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </button>

        <div className="flex items-center gap-2">
          {order.status !== 'cancelled' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRecalculate}
                loading={recalculating}
                title="Apply newly updated soap manufacturing costs and shared unit costs to this order"
              >
                <Calculator className="h-3.5 w-3.5 text-primary-600" />
                Apply Latest Soap Costs
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRefundAmount(netSales.toString());
                  setIsRefundModalOpen(true);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Issue Refund
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsCancelModalOpen(true)}
              >
                <Ban className="h-3.5 w-3.5" />
                Cancel Order
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Header Overview Banner */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 font-mono">
                {order.order_number || `#${order.id}`}
              </h2>
              <Badge status={order.status || 'confirmed'} />
              <Badge status={order.payment_status || 'paid'} />
              <Badge status={order.sync_status || 'synced'} />
            </div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              Placed on {formatDateTime(order.order_date || order.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              <span className="text-gray-400 block font-medium">Channel</span>
              <span className="font-semibold text-gray-800 capitalize">
                {order.channel?.name || order.channel_name || order.channel_type || 'Direct'}
              </span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              <span className="text-gray-400 block font-medium">Customer</span>
              <span className="font-semibold text-gray-800">{order.customer_name || 'Walk-in'}</span>
            </div>
          </div>
        </div>

        {/* Customer Address & Remarks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs">
          <div>
            <span className="font-semibold text-gray-700 block mb-0.5">Shipping Address / Contact</span>
            <div className="text-gray-600">
              <p>
                {(() => {
                  if (!order.shipping_address) return 'No address specified';
                  try {
                    const parsed = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address;
                    if (typeof parsed === 'object' && parsed !== null) {
                      const parts = [
                        parsed.address1,
                        parsed.address2,
                        parsed.city,
                        parsed.state || parsed.province,
                        parsed.pincode || parsed.zip,
                        parsed.country
                      ].filter(Boolean);
                      return parts.length > 0 ? parts.join(', ') : order.shipping_address;
                    }
                  } catch (_) {}
                  return order.shipping_address;
                })()}
              </p>
              {order.customer_phone && <span className="block mt-0.5 text-gray-500 font-mono">Phone: {order.customer_phone}</span>}
              {order.customer_email && <span className="block text-gray-500">Email: {order.customer_email}</span>}
            </div>
          </div>
          <div>
            <span className="font-semibold text-gray-700 block mb-0.5">Notes & Delivery Instructions</span>
            <p className="text-gray-600 italic">{order.notes || 'No special instructions recorded.'}</p>
          </div>
        </div>
      </div>

      {/* Items & COGS Snapshot Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50">
          <h3 className="text-sm font-bold text-gray-900">Line Items & Unit Cost Snapshots</h3>
          <p className="text-xs text-gray-500">Historical costs locked in at time of order creation</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Discount</th>
                <th className="py-3 px-4 text-right">Mfg Cost</th>
                <th className="py-3 px-4 text-right">Pkg Cost</th>
                <th className="py-3 px-4 text-right">Shared Cost</th>
                <th className="py-3 px-4 text-right bg-indigo-50/40 text-indigo-900" title="Formula 1: Landed COGS = Mfg + Pkg + Shared">
                  Landed COGS <span className="block text-[10px] text-indigo-600 font-normal">(= Mfg + Pkg + Shared)</span>
                </th>
                <th className="py-3 px-4 text-right font-bold">Net Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it, idx) => {
                const qty = it.quantity || 1;
                const mfg = parseFloat(it.manufacturing_cost_snapshot ?? it.manufacturing_cost) || 0;
                const pkg = parseFloat(it.packaging_cost_snapshot ?? it.packaging_cost) || 0;
                const shared = parseFloat(it.shared_cost_snapshot) || 0;
                const landed = parseFloat(it.landed_cost_snapshot) || (mfg + pkg + shared);
                const lineCogs = parseFloat(it.cogs) || (landed * (it.bars_sold || qty));
                const lineTotal = parseFloat(it.net_revenue ?? it.net_product_sales ?? ((it.selling_price || it.unit_price) * qty - (it.discount || 0)));

                return (
                  <tr key={idx} className="hover:bg-gray-50/70">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-900 block">
                        {it.product_name || it.variant?.product?.name || 'Product'} - {it.variant_name || it.variant?.name || 'Variant'}
                      </span>
                      <span className="font-mono text-[11px] text-gray-400">
                        {it.sku || it.variant?.sku}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-gray-800">{qty}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{formatCurrency(it.unit_price || it.selling_price)}</td>
                    <td className="py-3 px-4 text-right text-red-600 font-mono">
                      {parseFloat(it.discount) > 0 ? `-${formatCurrency(it.discount)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 font-mono">{formatCurrency(mfg)}</td>
                    <td className="py-3 px-4 text-right text-gray-600 font-mono">{formatCurrency(pkg)}</td>
                    <td className="py-3 px-4 text-right text-gray-600 font-mono">{formatCurrency(shared)}</td>
                    <td className="py-3 px-4 text-right font-bold text-indigo-700 bg-indigo-50/20 font-mono" title={`Formula 1: ₹${mfg} (mfg) + ₹${pkg} (pkg) + ₹${shared} (shared) = ₹${landed} per bar`}>
                      {formatCurrency(lineCogs)}
                      <span className="block text-[10px] text-indigo-500 font-normal">
                        ({formatCurrency(mfg)}+{formatCurrency(pkg)}+{formatCurrency(shared)})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900 font-mono">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formula & Detailed Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Costs Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary-600" />
            Revenue & Cost Architecture
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-600">Gross Sales Price (per sale):</span>
              <span className="font-semibold text-gray-900">{formatCurrency(order.gross_sales || netSales)}</span>
            </div>
            {parseFloat(order.discount_total || order.total_discounts || 0) > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-600">Promotional Discount Given:</span>
                <span className="font-semibold text-red-600">- {formatCurrency(order.discount_total || order.total_discounts || 0)}</span>
              </div>
            )}
            {parseFloat(order.shipping_charged || 0) > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-600">Shipping Charged to Customer:</span>
                <span className="font-semibold text-gray-900">+ {formatCurrency(order.shipping_charged || 0)}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 font-bold text-sm bg-gray-50 p-2 rounded">
              <span>Net Billed Revenue:</span>
              <span className="text-primary-700">{formatCurrency(netSales)}</span>
            </div>

            <div className="pt-2">
              <p className="font-semibold text-gray-500 uppercase tracking-wider text-[11px] mb-2">
                Variable Cost Deductions:
              </p>
              <div className="space-y-2 pl-2 border-l-2 border-red-200">
                {/* 1. COGS Group */}
                <div className="bg-gray-50/60 p-2.5 rounded border border-gray-100">
                  <div className="flex justify-between font-semibold text-gray-800">
                    <span>1. Landed Soap COGS (Formula 1 & 8):</span>
                    <span className="font-mono text-gray-900">- {formatCurrency(cogs)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    *Formula 1: Sum of Mfg + Pkg + Shared below. Deducted ONCE as COGS (not double-counted).
                  </p>
                  <div className="text-[11px] text-gray-500 mt-1 pl-2 space-y-0.5 border-l border-gray-200">
                    <div className="flex justify-between">
                      <span>• Soap Manufacturing (Oils & Herbs):</span>
                      <span className="font-mono">{formatCurrency(items.reduce((s, it) => s + (parseFloat(it.manufacturing_cost_snapshot || it.manufacturing_cost || 0) * (it.quantity || 1)), 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Packaging (Outer Box & Wrapper):</span>
                      <span className="font-mono">{formatCurrency(items.reduce((s, it) => s + (parseFloat(it.packaging_cost_snapshot || it.packaging_cost || 0) * (it.quantity || 1)), 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Shared Unit Costs (Leaflet + Bubble Wrap):</span>
                      <span className="font-mono">{formatCurrency(items.reduce((s, it) => s + (parseFloat(it.shared_cost_snapshot || 0) * (it.quantity || 1)), 0))}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Channel & Courier Group */}
                <div className="bg-gray-50/60 p-2 rounded border border-gray-100">
                  <div className="flex justify-between font-semibold text-gray-800">
                    <span>2. Sales Channel & Courier Costs (Formula 7):</span>
                    <span className="font-mono text-gray-900">- {formatCurrency(channelFee)}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 pl-2 space-y-0.5">
                    {courierCost > 0 && (
                      <div className="flex justify-between">
                        <span>• Courier Delivery Shipping:</span>
                        <span className="font-mono">{formatCurrency(courierCost)}</span>
                      </div>
                    )}
                    {channelFee > courierCost && (
                      <div className="flex justify-between">
                        <span>• Payment Gateway & Platform Take-Rate:</span>
                        <span className="font-mono">{formatCurrency(channelFee - courierCost)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Total Deductions */}
                <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                  <span>Total Direct Expenses (COGS + Channel):</span>
                  <span className="font-mono text-red-600">- {formatCurrency(cogs + channelFee)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contribution Formula Card */}
        <div className="bg-gradient-to-br from-sidebar to-primary-950 text-white rounded-xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-4">
              <Calculator className="h-5 w-5 text-indigo-400" />
              <h3 className="font-bold text-sm tracking-wide">Contribution Formula Breakdown</h3>
            </div>

            <div className="bg-white/10 p-3.5 rounded-lg border border-white/10 text-xs font-mono space-y-2 mb-4">
              <p className="text-indigo-300">
                Formula 9: Contribution = Net Revenue − Channel Costs − COGS
              </p>
              <p className="text-white">
                = {formatCurrency(netSales)} − ({formatCurrency(channelFee)} Channel + {formatCurrency(cogs)} COGS)
              </p>
              <p className="text-emerald-300 font-bold text-sm pt-1 border-t border-white/10">
                = {formatCurrency(contribution)}
              </p>
            </div>

            <div className="bg-white/10 p-3.5 rounded-lg border border-white/10 text-xs font-mono space-y-1">
              <p className="text-indigo-300">
                Margin % = (Contribution / Net Sales) * 100
              </p>
              <p className="text-emerald-300 font-bold text-sm">
                = {formatPercent(marginPercent)}
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between">
            <div>
              <span className="text-xs text-indigo-300 block">True Contribution Profit:</span>
              <span className={`text-2xl font-black font-mono ${
                contribution >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {formatCurrency(contribution)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-indigo-300 block">Unit Efficiency:</span>
              <span className="text-xl font-bold font-mono text-white">
                {formatPercent(marginPercent)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Refunds Section */}
      {refunds.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-red-500" />
            Refund History
          </h3>
          <div className="space-y-2">
            {refunds.map((ref, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-50 text-xs">
                <div>
                  <span className="font-semibold text-red-900">{formatCurrency(ref.amount)}</span>
                  <p className="text-red-600 mt-0.5">{ref.reason || 'No reason provided'}</p>
                </div>
                <div className="text-right text-red-400">
                  <span>{formatDate(ref.created_at)}</span>
                  {ref.restock_items && <span className="block text-[10px] text-green-700">Items Restocked</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Confirm Order Cancellation"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCancelModalOpen(false)}>
              Back
            </Button>
            <Button variant="danger" onClick={handleCancelOrder} loading={cancelling}>
              Cancel Order
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to cancel order <b>{order.order_number || `#${order.id}`}</b>? This will reverse reserve inventory and update financial reports.
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Cancellation Reason</label>
          <textarea
            rows="2"
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="e.g. Buyer requested cancellation before dispatch"
            className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>
      </Modal>

      {/* Issue Refund Modal */}
      <Modal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        title="Issue Refund for Order"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsRefundModalOpen(false)}>
              Cancel
            </Button>
            <Button form="refund-form" type="submit" variant="danger" loading={refunding}>
              Confirm Refund
            </Button>
          </>
        }
      >
        <form id="refund-form" onSubmit={handleAddRefund} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Refund Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              max={netSales}
              required
              value={refundAmount}
              onChange={e => setRefundAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">Maximum eligible: {formatCurrency(netSales)}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason for Refund *</label>
            <input
              type="text"
              required
              placeholder="e.g. Transit damage, customer return, duplicate order"
              value={refundReason}
              onChange={e => setRefundReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="restock"
              checked={restockItems}
              onChange={e => setRestockItems(e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="restock" className="text-xs text-gray-700 font-medium">
              Automatically restock items back into active inventory
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
