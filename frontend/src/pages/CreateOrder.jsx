import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Calculator, ShoppingBag, Truck,
  CreditCard, CheckCircle2, AlertCircle, Zap, Tag, Percent,
  Search, MapPin, User, Package, ChevronDown, Check, Store
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../components/UI/Toast';
import Button from '../components/UI/Button';
import { formatCurrency, formatPercent } from '../utils/formatters';

export default function CreateOrder() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Channel & General State
  const [channelId, setChannelId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('manual, erp');

  // Customer State (Shopify Style)
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');

  // Product Search & Picker State
  const [productSearch, setProductSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchDropdownRef = useRef(null);

  // Line Items State
  const [items, setItems] = useState([]);

  // Order-Level Discount State (Shopify Style)
  const [showOrderDiscount, setShowOrderDiscount] = useState(false);
  const [orderDiscountType, setOrderDiscountType] = useState('fixed'); // 'fixed' or 'percent'
  const [orderDiscountValue, setOrderDiscountValue] = useState('');
  const [orderDiscountReason, setOrderDiscountReason] = useState('');

  // Shipping State (Shopify Style)
  const [shippingRateName, setShippingRateName] = useState('Standard Shipping');
  const [shippingCharged, setShippingCharged] = useState('0');
  const [actualShippingExpense, setActualShippingExpense] = useState('0');

  // Payment Status & Shopify Sync
  const [paymentStatus, setPaymentStatus] = useState('paid'); // 'paid' or 'pending'
  const [gatewayFee, setGatewayFee] = useState('0');
  const [syncToShopify, setSyncToShopify] = useState(true);
  const [storeSettings, setStoreSettings] = useState(null);

  // Fetch initial channels, products, and store settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cRes, pRes, sRes] = await Promise.all([
          api.get('/channels'),
          api.get('/products'),
          api.get('/settings').catch(() => ({ data: {} }))
        ]);
        const chList = cRes.data?.data || cRes.data || [];
        const prList = pRes.data?.data || pRes.data || [];
        const sData = sRes.data?.data || sRes.data || {};
        setChannels(Array.isArray(chList) ? chList : []);
        setProducts(Array.isArray(prList) ? prList : []);
        setStoreSettings(sData);

        if (chList.length > 0) {
          // Default to Direct / Offline or first available non-shopify channel
          const directCh = chList.find(c => c.name?.toLowerCase().includes('direct') || c.type !== 'shopify');
          setChannelId(directCh ? (directCh.id || directCh._id) : (chList[0].id || chList[0]._id));
        }

        // Initialize with first product if available
        if (prList.length > 0 && prList[0].variants?.[0]) {
          const firstP = prList[0];
          const firstV = firstP.variants[0];
          setItems([
            {
              variant_id: firstV.id,
              product_id: firstP.id,
              product_name: firstP.name,
              variant_name: firstV.name,
              sku: firstV.sku,
              quantity: 1,
              unit_price: parseFloat(firstV.selling_price) || 0,
              discount_type: 'fixed',
              discount_val: 0,
              discount_amount: 0,
              discount_reason: '',
              show_discount_input: false,
              available_stock: firstV.available_qty ?? firstV.stock_quantity ?? 0,
              manufacturing_cost: parseFloat(firstV.manufacturing_cost) || 0,
              packaging_cost: parseFloat(firstV.packaging_cost) || 0,
              other_cost: parseFloat(firstV.other_cost) || 0,
            }
          ]);
        }
      } catch (err) {
        addToast('Failed to load products or sales channels', 'error');
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchData();
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Accent & diacritic insensitive text normalizer
  const normalizeText = (txt) => {
    if (!txt) return '';
    return txt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  // Flattened searchable variants
  const allVariants = useMemo(() => {
    const list = [];
    products.forEach(p => {
      (p.variants || []).forEach(v => {
        list.push({
          variant_id: v.id,
          product_id: p.id,
          product_name: p.name,
          variant_name: v.name,
          sku: v.sku,
          selling_price: parseFloat(v.selling_price) || 0,
          manufacturing_cost: parseFloat(v.manufacturing_cost) || 0,
          packaging_cost: parseFloat(v.packaging_cost) || 0,
          other_cost: parseFloat(v.other_cost) || 0,
          available_stock: v.available_qty ?? v.stock_quantity ?? 0,
          category: p.category || 'General',
        });
      });
    });
    return list;
  }, [products]);

  // Filtered variants based on accent-insensitive search
  const filteredVariants = useMemo(() => {
    if (!productSearch.trim()) return allVariants;
    const q = normalizeText(productSearch);
    return allVariants.filter(v =>
      normalizeText(v.product_name).includes(q) ||
      normalizeText(v.sku).includes(q) ||
      normalizeText(v.variant_name).includes(q)
    );
  }, [allVariants, productSearch]);

  const selectedChannel = useMemo(() => {
    return channels.find(c => String(c.id || c._id) === String(channelId));
  }, [channels, channelId]);

  // Add product variant to items
  const addVariantToOrder = (variant) => {
    // Check if variant already in items
    const existingIndex = items.findIndex(it => String(it.variant_id) === String(variant.variant_id));
    if (existingIndex >= 0) {
      // Increase quantity
      setItems(prev => {
        const copy = [...prev];
        copy[existingIndex].quantity = (copy[existingIndex].quantity || 1) + 1;
        // recalculate item discount if percent
        if (copy[existingIndex].discount_type === 'percent') {
          const gross = copy[existingIndex].quantity * copy[existingIndex].unit_price;
          copy[existingIndex].discount_amount = (gross * (parseFloat(copy[existingIndex].discount_val) || 0)) / 100;
        }
        return copy;
      });
    } else {
      setItems(prev => [
        ...prev,
        {
          variant_id: variant.variant_id,
          product_id: variant.product_id,
          product_name: variant.product_name,
          variant_name: variant.variant_name,
          sku: variant.sku,
          quantity: 1,
          unit_price: variant.selling_price,
          discount_type: 'fixed',
          discount_val: 0,
          discount_amount: 0,
          discount_reason: '',
          show_discount_input: false,
          available_stock: variant.available_stock,
          manufacturing_cost: variant.manufacturing_cost,
          packaging_cost: variant.packaging_cost,
          other_cost: variant.other_cost,
        }
      ]);
    }
    setProductSearch('');
    setShowSearchDropdown(false);
  };

  // Add custom unlisted item
  const addCustomItem = () => {
    const fallbackVariant = allVariants[0];
    setItems(prev => [
      ...prev,
      {
        variant_id: fallbackVariant ? fallbackVariant.variant_id : 4,
        product_id: fallbackVariant ? fallbackVariant.product_id : 3,
        product_name: 'Custom Product / Service',
        variant_name: 'Standard',
        sku: 'CUSTOM-ITEM',
        quantity: 1,
        unit_price: 100,
        discount_type: 'fixed',
        discount_val: 0,
        discount_amount: 0,
        discount_reason: '',
        show_discount_input: false,
        available_stock: 999,
        manufacturing_cost: 0,
        packaging_cost: 0,
        other_cost: 0,
      }
    ]);
  };

  const updateItemQty = (index, newQty) => {
    const qty = Math.max(1, parseInt(newQty, 10) || 1);
    setItems(prev => {
      const copy = [...prev];
      copy[index].quantity = qty;
      if (copy[index].discount_type === 'percent') {
        const gross = qty * copy[index].unit_price;
        copy[index].discount_amount = (gross * (parseFloat(copy[index].discount_val) || 0)) / 100;
      }
      return copy;
    });
  };

  const updateItemPrice = (index, newPrice) => {
    const price = Math.max(0, parseFloat(newPrice) || 0);
    setItems(prev => {
      const copy = [...prev];
      copy[index].unit_price = price;
      if (copy[index].discount_type === 'percent') {
        const gross = copy[index].quantity * price;
        copy[index].discount_amount = (gross * (parseFloat(copy[index].discount_val) || 0)) / 100;
      }
      return copy;
    });
  };

  const updateItemDiscount = (index, { type, val, reason }) => {
    setItems(prev => {
      const copy = [...prev];
      const it = { ...copy[index] };
      if (type !== undefined) it.discount_type = type;
      if (val !== undefined) it.discount_val = val;
      if (reason !== undefined) it.discount_reason = reason;

      const numVal = parseFloat(it.discount_val) || 0;
      const lineGross = it.quantity * it.unit_price;
      if (it.discount_type === 'percent') {
        it.discount_amount = Math.min(lineGross, (lineGross * numVal) / 100);
      } else {
        it.discount_amount = Math.min(lineGross, numVal);
      }

      copy[index] = it;
      return copy;
    });
  };

  const toggleItemDiscountRow = (index) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index].show_discount_input = !copy[index].show_discount_input;
      return copy;
    });
  };

  const removeItemRow = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Shared unit costs from store settings
  const sharedUnitCosts = useMemo(() => {
    if (!storeSettings?.shared_unit_costs) return [];
    const raw = storeSettings.shared_unit_costs;
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch (_) { return []; }
  }, [storeSettings]);

  const totalSharedCostPerUnit = useMemo(() => {
    return sharedUnitCosts.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
  }, [sharedUnitCosts]);

  // Real-time Financial Calculations (Shopify Totals + The Gaav ERP Margins)
  const calculation = useMemo(() => {
    let grossItems = 0;
    let totalLineDiscounts = 0;
    let totalCogs = 0;
    let totalBars = 0;

    items.forEach(it => {
      const qty = parseInt(it.quantity, 10) || 0;
      const price = parseFloat(it.unit_price) || 0;
      const disc = parseFloat(it.discount_amount) || 0;
      const mfg = parseFloat(it.manufacturing_cost) || 0;
      const pkg = parseFloat(it.packaging_cost) || 0;
      const oth = parseFloat(it.other_cost) || 0;
      const unitLandedCost = mfg + pkg + oth + totalSharedCostPerUnit;

      grossItems += price * qty;
      totalLineDiscounts += disc;
      totalCogs += unitLandedCost * qty;
      totalBars += qty;
    });

    const subtotalAfterLineDiscounts = Math.max(0, grossItems - totalLineDiscounts);

    // Calculate order-level discount
    let orderDiscountAmt = 0;
    const numOrderDiscVal = parseFloat(orderDiscountValue) || 0;
    if (numOrderDiscVal > 0) {
      if (orderDiscountType === 'percent') {
        orderDiscountAmt = Math.min(subtotalAfterLineDiscounts, (subtotalAfterLineDiscounts * numOrderDiscVal) / 100);
      } else {
        orderDiscountAmt = Math.min(subtotalAfterLineDiscounts, numOrderDiscVal);
      }
    }

    const totalDiscounts = totalLineDiscounts + orderDiscountAmt;
    const shipCharged = parseFloat(shippingCharged) || 0;
    const netSales = Math.max(0, grossItems - totalDiscounts) + shipCharged;

    // Phase 1 Unit Economics (Formula 7 & 8)
    const commPct = parseFloat(selectedChannel?.commission_pct) || 0;
    const gatePct = parseFloat(selectedChannel?.gateway_pct) || 0;
    const defaultCourierExpense = parseFloat(selectedChannel?.shipping_per_sale) || 0;
    const otherVarCost = parseFloat(selectedChannel?.other_variable_cost) || 0;

    // Platform Commission & Variable fees
    const channelCommission = (netSales * commPct) + (totalBars * otherVarCost);

    // Gateway fee: if user typed a custom gatewayFee, use it; otherwise compute netSales * gateway_pct
    const pgFee = (gatewayFee !== '' && gatewayFee !== '0')
      ? parseFloat(gatewayFee) || 0
      : (netSales * gatePct);

    // Courier expense: if user entered custom actualShippingExpense, use it; otherwise defaultCourierExpense
    const actualShip = (actualShippingExpense !== '' && actualShippingExpense !== '0')
      ? parseFloat(actualShippingExpense) || 0
      : defaultCourierExpense;

    const totalDirectExpenses = totalCogs + channelCommission + actualShip + pgFee;
    const contributionAmount = netSales - totalDirectExpenses;
    const contributionMargin = netSales > 0 ? (contributionAmount / netSales) * 100 : 0;

    return {
      grossItems,
      totalLineDiscounts,
      orderDiscountAmt,
      totalDiscounts,
      shipCharged,
      netSales,
      totalCogs,
      totalSharedCostPerUnit,
      channelCommission,
      actualShip,
      pgFee,
      totalDirectExpenses,
      contributionAmount,
      contributionMargin,
    };
  }, [items, orderDiscountType, orderDiscountValue, shippingCharged, actualShippingExpense, gatewayFee, selectedChannel, totalSharedCostPerUnit]);

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!channelId) {
      addToast('Please select a sales channel', 'error');
      return;
    }
    if (items.length === 0) {
      addToast('Please add at least one product to the order', 'error');
      return;
    }
    const invalidItem = items.find(it => !it.variant_id && !it.product_name);
    if (invalidItem) {
      addToast('Please ensure all items have a valid variant or title', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const structuredAddress = {
        address1,
        address2,
        city,
        state,
        pincode,
        country
      };

      const payload = {
        channel_id: parseInt(channelId, 10),
        order_number: orderNumber || undefined,
        order_date: orderDate,
        customer_name: customerName || 'Direct Customer',
        customer_contact: customerPhone || customerEmail || undefined,
        customer_email: customerEmail || undefined,
        customer_phone: customerPhone || undefined,
        shipping_address: structuredAddress,
        payment_status: paymentStatus,
        notes: notes ? `${notes} | Tags: ${tags}` : `Tags: ${tags}`,
        shipping_charged: parseFloat(shippingCharged) || 0,
        actual_shipping_expense: parseFloat(actualShippingExpense) || 0,
        order_discount: calculation.orderDiscountAmt,
        gateway_fee: parseFloat(gatewayFee) || 0,
        sync_to_shopify: syncToShopify,
        items: items.map(it => ({
          variant_id: parseInt(it.variant_id, 10) || 1,
          quantity: parseInt(it.quantity, 10) || 1,
          selling_price: parseFloat(it.unit_price) || 0,
          unit_price: parseFloat(it.unit_price) || 0,
          discount: parseFloat(it.discount_amount) || 0,
          manufacturing_cost: parseFloat(it.manufacturing_cost) || 0,
          packaging_cost: parseFloat(it.packaging_cost) || 0,
          other_cost: parseFloat(it.other_cost) || 0,
        })),
      };

      const res = await api.post('/orders', payload);
      const createdId = res.data?.data?.id || res.data?.data?.order?.id || res.data?.id;
      const syncInfo = res.data?.data?.shopifySync;

      if (syncInfo?.success) {
        addToast(`✅ Order created & pushed to Shopify (#${syncInfo.shopify_order_number}) with discounts! Shopify stock decremented!`, 'success');
      } else if (syncInfo?.error) {
        addToast(`Order saved locally. Shopify notice: ${syncInfo.error}`, 'warning');
      } else {
        addToast('Order recorded successfully in The Gaav ERP!', 'success');
      }

      navigate(createdId ? `/orders/${createdId}` : '/orders');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header matching Shopify Create Order */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Back to Orders"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Create order
              <span className="text-[11px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                Shopify Two-Way Enabled
              </span>
            </h1>
            <p className="text-xs text-gray-500">
              Create an order with discounts, customer address, and automatic Shopify centralized stock deduction.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/orders')}
            size="sm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-order-form"
            loading={submitting}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Save order
          </Button>
        </div>
      </div>

      <form id="create-order-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Left Column: Products, Discounts, Shipping, Payment (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Products Section (Shopify Style Card) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-600" />
                  Products
                </h2>
                <p className="text-xs text-gray-500">Search and select items with live centralized stock</p>
              </div>

              <button
                type="button"
                onClick={addCustomItem}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add custom item
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Product Search & Autocomplete Picker */}
              <div className="relative" ref={searchDropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => {
                      setProductSearch(e.target.value);
                      setShowSearchDropdown(true);
                    }}
                    onFocus={() => setShowSearchDropdown(true)}
                    placeholder="Search products by title, SKU (e.g. Utanē, Kānti, Nikhār, Nirmaḷ)..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                {/* Quick Add Product Buttons */}
                {allVariants.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    <span className="text-[11px] font-semibold text-gray-500 mr-1">Quick Add:</span>
                    {allVariants.map(v => (
                      <button
                        key={v.variant_id}
                        type="button"
                        onClick={() => addVariantToOrder(v)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[11px] font-semibold transition-all hover:scale-[1.02] shadow-2xs"
                      >
                        <Plus className="h-3 w-3 text-emerald-600" />
                        <span>{v.product_name}</span>
                        <span className="text-[10px] text-emerald-600 font-mono">({v.available_stock})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Search Dropdown */}
                {showSearchDropdown && (
                  <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-xl max-h-72 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Shopify Centralized Catalog ({filteredVariants.length} items)
                    </div>
                    {filteredVariants.length === 0 ? (
                      <div className="p-4 text-xs text-center text-gray-500">No matching products found</div>
                    ) : (
                      filteredVariants.map(v => (
                        <div
                          key={v.variant_id}
                          onClick={() => addVariantToOrder(v)}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-xs shrink-0">
                              {v.product_name.slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-900">{v.product_name}</div>
                              <div className="text-[11px] text-gray-500">
                                Variant: <span className="text-gray-700">{v.variant_name}</span> &bull; SKU: <span className="font-mono text-gray-700">{v.sku}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-gray-900">{formatCurrency(v.selling_price)}</div>
                            <div className={`text-[11px] font-medium ${v.available_stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {v.available_stock} available
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Items Table / Cards */}
              {items.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
                  <ShoppingBag className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-600">No products added yet</p>
                  <p className="text-[11px] text-gray-400">Search above or click "Add custom item" to begin</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((it, idx) => {
                    const lineGross = it.quantity * it.unit_price;
                    const lineNet = Math.max(0, lineGross - it.discount_amount);

                    return (
                      <div key={idx} className="border border-gray-200 rounded-xl p-3.5 bg-white space-y-3 hover:border-gray-300 transition-colors">
                        {/* Main Line Item Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                              {it.product_name.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-gray-900 truncate">{it.product_name}</h4>
                              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                <span>{it.variant_name}</span>
                                <span>&bull;</span>
                                <span className="font-mono text-gray-600">{it.sku}</span>
                                <span>&bull;</span>
                                <span className={`font-semibold ${it.available_stock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {it.available_stock} in stock
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Inputs: Price, Quantity, Discount button, Total, Remove */}
                          <div className="flex items-center gap-3 self-end sm:self-center">
                            {/* Price */}
                            <div className="w-24">
                              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Price</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1.5 text-xs text-gray-400">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={it.unit_price}
                                  onChange={e => updateItemPrice(idx, e.target.value)}
                                  className="w-full pl-5 pr-2 py-1 text-xs border border-gray-300 rounded-lg text-right font-medium focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Quantity with Stepper */}
                            <div className="w-20">
                              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Quantity</label>
                              <input
                                type="number"
                                min="1"
                                value={it.quantity}
                                onChange={e => updateItemQty(idx, e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg text-center font-medium focus:ring-1 focus:ring-primary-500 focus:outline-none"
                              />
                            </div>

                            {/* Total Line Amount */}
                            <div className="w-24 text-right">
                              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Total</label>
                              <div className="text-xs font-bold text-gray-900">
                                {formatCurrency(lineNet)}
                              </div>
                              {it.discount_amount > 0 && (
                                <div className="text-[10px] text-gray-400 line-through">
                                  {formatCurrency(lineGross)}
                                </div>
                              )}
                            </div>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Item-Level Discount Action & Drawer (Shopify Style) */}
                        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => toggleItemDiscountRow(idx)}
                            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            <Tag className="h-3.5 w-3.5" />
                            {it.discount_amount > 0 ? (
                              <span className="text-emerald-700 font-semibold">
                                Discount applied: -{formatCurrency(it.discount_amount)} ({it.discount_reason || 'Custom'})
                              </span>
                            ) : (
                              <span>+ Add line discount</span>
                            )}
                          </button>

                          {/* COGS Snapshot preview for this line */}
                          <div className="text-[11px] text-gray-500">
                            Landed Unit COGS: <span className="text-indigo-700 font-mono font-bold">{formatCurrency(parseFloat(it.manufacturing_cost || 0) + parseFloat(it.packaging_cost || 0) + parseFloat(it.other_cost || 0) + totalSharedCostPerUnit)}</span>
                            <span className="text-[10px] text-gray-400 ml-1.5 font-normal">
                              (Mfg {formatCurrency(it.manufacturing_cost)} + Pkg {formatCurrency(it.packaging_cost)} + Shared {formatCurrency(totalSharedCostPerUnit)})
                            </span>
                          </div>
                        </div>

                        {/* Inline Item Discount Editor */}
                        {it.show_discount_input && (
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 mb-1">Discount Type</label>
                              <div className="flex rounded-md shadow-xs">
                                <button
                                  type="button"
                                  onClick={() => updateItemDiscount(idx, { type: 'fixed' })}
                                  className={`px-3 py-1 text-xs font-semibold rounded-l-md border ${it.discount_type === 'fixed' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300'}`}
                                >
                                  ₹ Fixed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateItemDiscount(idx, { type: 'percent' })}
                                  className={`px-3 py-1 text-xs font-semibold rounded-r-md border-t border-r border-b ${it.discount_type === 'percent' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300'}`}
                                >
                                  % Percent
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 mb-1">Discount Value</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={it.discount_type === 'percent' ? 'e.g. 10%' : 'e.g. ₹50'}
                                value={it.discount_val || ''}
                                onChange={e => updateItemDiscount(idx, { val: e.target.value })}
                                className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 mb-1">Reason / Note</label>
                              <input
                                type="text"
                                placeholder="e.g. Clearance, damaged box"
                                value={it.discount_reason}
                                onChange={e => updateItemDiscount(idx, { reason: e.target.value })}
                                className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 2. Order-Level Discounts & Shipping (Shopify Style) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
              <span>Discounts & Shipping Adjustments</span>
              <span className="text-[11px] font-normal text-gray-400">Shopify Compliant</span>
            </h2>

            {/* Order Discount Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowOrderDiscount(!showOrderDiscount)}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1.5"
                >
                  <Tag className="h-3.5 w-3.5" />
                  {showOrderDiscount ? 'Hide order discount' : '+ Add order-level discount code / coupon'}
                </button>

                {calculation.orderDiscountAmt > 0 && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Order Discount: -{formatCurrency(calculation.orderDiscountAmt)}
                  </span>
                )}
              </div>

              {showOrderDiscount && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Discount Type</label>
                    <div className="flex rounded-md shadow-xs">
                      <button
                        type="button"
                        onClick={() => setOrderDiscountType('fixed')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-l-md border ${orderDiscountType === 'fixed' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300'}`}
                      >
                        ₹ Flat
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderDiscountType('percent')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-r-md border-t border-r border-b ${orderDiscountType === 'percent' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300'}`}
                      >
                        % Percent
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Discount Amount / %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={orderDiscountType === 'percent' ? 'e.g. 10 for 10%' : 'e.g. 100'}
                      value={orderDiscountValue}
                      onChange={e => setOrderDiscountValue(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Coupon Code / Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. FESTIVE10, OFFLINE50"
                      value={orderDiscountReason}
                      onChange={e => setOrderDiscountReason(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none font-mono uppercase"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Shipping Box */}
            <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Shipping Rate Name</label>
                <input
                  type="text"
                  value={shippingRateName}
                  onChange={e => setShippingRateName(e.target.value)}
                  placeholder="Standard Shipping"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Charged to Customer (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-gray-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingCharged}
                    onChange={e => setShippingCharged(e.target.value)}
                    className="w-full pl-6 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Actual Courier Expense (₹)
                  <span className="text-[10px] text-gray-400 font-normal ml-1">(ERP Cost)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-gray-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={actualShippingExpense}
                    onChange={e => setActualShippingExpense(e.target.value)}
                    className="w-full pl-6 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Payment Status & Notes Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
              Payment & Additional Notes
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Payment Status *</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`p-3 rounded-lg border text-center cursor-pointer transition-all ${paymentStatus === 'paid' ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold ring-1 ring-emerald-500' : 'border-gray-200 bg-white text-gray-700'}`}>
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="paid"
                      checked={paymentStatus === 'paid'}
                      onChange={() => setPaymentStatus('paid')}
                      className="sr-only"
                    />
                    <div className="text-xs">Paid / Collected</div>
                    <div className="text-[10px] text-gray-500 font-normal">UPI, Cash, POS</div>
                  </label>

                  <label className={`p-3 rounded-lg border text-center cursor-pointer transition-all ${paymentStatus === 'pending' ? 'border-amber-500 bg-amber-50/50 text-amber-900 font-bold ring-1 ring-amber-500' : 'border-gray-200 bg-white text-gray-700'}`}>
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="pending"
                      checked={paymentStatus === 'pending'}
                      onChange={() => setPaymentStatus('pending')}
                      className="sr-only"
                    />
                    <div className="text-xs">Payment Pending</div>
                    <div className="text-[10px] text-gray-500 font-normal">COD, Invoiced</div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">PG / Transaction Fee (₹)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-gray-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={gatewayFee}
                    onChange={e => setGatewayFee(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Payment gateway or POS fee incurred on this order</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Order Notes (Customer / Delivery)</label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Special instructions, delivery requests, or staff notes..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="e.g. manual, staff, walk-in, vip"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Customer, Channel, Sync, & Live Margin Panel (1 col) */}
        <div className="space-y-6">

          {/* 1. Customer Card (Shopify Style) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
              <User className="h-4 w-4 text-gray-600" />
              Customer
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone / WhatsApp</label>
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Shipping Address Inputs */}
              <div className="pt-2 border-t border-gray-100 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                  <MapPin className="h-3.5 w-3.5 text-gray-500" />
                  Shipping Address
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Address Line 1 (Flat, House no., Building, Street)"
                    value={address1}
                    onChange={e => setAddress1(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Address Line 2 (Area, Landmark - Optional)"
                    value={address2}
                    onChange={e => setAddress2(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="City (e.g. Mumbai)"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="State (e.g. Maharashtra)"
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="PIN Code (e.g. 400001)"
                    value={pincode}
                    onChange={e => setPincode(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none font-mono"
                  />
                  <input
                    type="text"
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-gray-50 focus:outline-none text-gray-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Channel & Centralized Shopify Sync Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
              <Store className="h-4 w-4 text-gray-600" />
              Sales Channel & Sync
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Sales Channel *</label>
              <select
                required
                value={channelId}
                onChange={e => setChannelId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                {channels.map(c => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Order Date</label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            {/* Centralized Shopify Two-Way Switch */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  Push to Shopify Admin
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncToShopify}
                    onChange={e => setSyncToShopify(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
              <p className="text-[11px] text-emerald-700 leading-tight">
                Automatically creates this order in Shopify Admin and decrements centralized inventory count obeying policy.
              </p>
            </div>
          </div>

          {/* 3. Live Contribution Margin & Order Summary Panel (The Gaav ERP superpower) */}
          <div className="bg-gradient-to-br from-sidebar to-primary-950 rounded-xl p-5 text-white shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-indigo-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-200">Order Summary & Margins</h3>
              </div>
              <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-emerald-300">
                LIVE
              </span>
            </div>

            {/* Revenue Totals Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-indigo-200">
                <span>Subtotal ({items.reduce((s, it) => s + (parseInt(it.quantity, 10) || 0), 0)} items):</span>
                <span className="font-mono text-white">{formatCurrency(calculation.grossItems)}</span>
              </div>

              {calculation.totalDiscounts > 0 && (
                <div className="flex justify-between text-red-300">
                  <span>Total Discounts:</span>
                  <span className="font-mono">- {formatCurrency(calculation.totalDiscounts)}</span>
                </div>
              )}

              <div className="flex justify-between text-indigo-200">
                <span>Shipping:</span>
                <span className="font-mono text-white">+ {formatCurrency(calculation.shipCharged)}</span>
              </div>

              <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-white/10">
                <span>Total Amount:</span>
                <span className="font-mono text-emerald-300">{formatCurrency(calculation.netSales)}</span>
              </div>
            </div>

            {/* Variable Costs & Margin Breakdown */}
            <div className="pt-2 border-t border-white/10 space-y-1.5 text-xs text-indigo-200">
              <div className="flex justify-between">
                <span>Landed COGS (Mfg+Pkg+Shared):</span>
                <span className="font-mono text-white">- {formatCurrency(calculation.totalCogs)}</span>
              </div>
              <div className="flex justify-between">
                <span>Channel Fee & Gateway:</span>
                <span className="font-mono text-white">- {formatCurrency(calculation.channelCommission + calculation.pgFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>Courier Expense:</span>
                <span className="font-mono text-white">- {formatCurrency(calculation.actualShip)}</span>
              </div>
            </div>

            {/* Net Contribution Profit Card */}
            <div className="p-3.5 rounded-lg bg-white/10 border border-white/10 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-indigo-200">Net Contribution:</span>
                <span className={`text-lg font-black font-mono ${calculation.contributionAmount >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                  {formatCurrency(calculation.contributionAmount)}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-indigo-200">Margin:</span>
                <span className={`font-bold font-mono ${calculation.contributionMargin >= 25 ? 'text-emerald-300' : (calculation.contributionMargin >= 10 ? 'text-yellow-300' : 'text-red-400')}`}>
                  {formatPercent(calculation.contributionMargin)}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              loading={submitting}
              className="w-full justify-center py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg text-xs font-bold uppercase tracking-wider"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Create order
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
