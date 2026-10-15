import React, { useState, useEffect } from 'react';
import {
  Globe, ShieldCheck, CheckCircle2, Clock, Key,
  Lock, ArrowRight, Zap, RefreshCw, Sparkles, AlertCircle,
  Package, ShoppingCart, ArrowDownToLine, ArrowUpFromLine,
  Send, ExternalLink, Terminal, Check, Copy, HelpCircle, Layers, Info, MapPin
} from 'lucide-react';
import api from '../api/axios';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import { useToast } from '../components/UI/Toast';
import { formatDate } from '../utils/formatters';

export default function ShopifyIntegration() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'simulator' | 'guide'

  // Auth Method Switcher: 'client_credentials' (2026 Recommended) | 'access_token' (Legacy)
  const [authMethod, setAuthMethod] = useState('client_credentials');

  // Settings State
  const [domain, setDomain] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [locationId, setLocationId] = useState('');
  const [apiVersion, setApiVersion] = useState('2025-01');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState('not_configured');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);
  const [syncingInventory, setSyncingInventory] = useState(false);
  const [connectedShop, setConnectedShop] = useState(null);

  // Webhook Events
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Simulation State
  const [simulating, setSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState(null);

  // Webhook Registration
  const [publicUrl, setPublicUrl] = useState('');
  const [registering, setRegistering] = useState(false);

  // Locations State
  const [locations, setLocations] = useState([]);
  const [fetchingLocations, setFetchingLocations] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      const store = res.data?.data || res.data || {};
      setDomain(store.shopify_domain || '');
      setClientId(store.shopify_client_id || '');
      setHasClientSecret(Boolean(store.has_client_secret));
      setHasAccessToken(Boolean(store.has_shopify_token));
      setWebhookSecret(store.shopify_webhook_secret || '');
      setLocationId(store.shopify_location_id || '');
      setApiVersion(store.shopify_api_version || '2025-01');
      setSyncEnabled(Boolean(store.sync_enabled));
      setSyncStatus(store.sync_status || 'not_configured');

      if (!store.shopify_client_id && store.has_shopify_token) {
        setAuthMethod('access_token');
      }
    } catch {
      addToast('Failed to load Shopify settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhookEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await api.get('/shopify/webhook-events');
      setEvents(res.data?.data || res.data || []);
    } catch {
      // quiet fail
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchWebhookEvents();
  }, []);

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();

    if (locationId && locationId.includes('@')) {
      addToast('Shopify Location ID must be a numeric ID (e.g. 7812345678), not an email address. Use Auto-Detect to find it.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.put('/settings/shopify', {
        shopify_domain: domain.trim(),
        shopify_client_id: clientId.trim() || undefined,
        shopify_client_secret: clientSecret.trim() || undefined,
        shopify_access_token: accessToken.trim() || undefined,
        shopify_webhook_secret: webhookSecret.trim() || undefined,
        shopify_location_id: locationId.trim() || undefined,
        shopify_api_version: apiVersion,
        sync_enabled: syncEnabled ? 1 : 0
      });
      addToast('Shopify credentials saved successfully', 'success');
      setClientSecret('');
      setAccessToken('');
      fetchSettings();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchLocations = async () => {
    if (!domain) {
      addToast('Please enter your Shopify Domain Name first (e.g. yourstore.myshopify.com)', 'warning');
      return;
    }

    setFetchingLocations(true);
    try {
      // Save current credentials first if they provided new ones
      await api.put('/settings/shopify', {
        shopify_domain: domain.trim(),
        shopify_client_id: clientId.trim() || undefined,
        shopify_client_secret: clientSecret.trim() || undefined,
        shopify_access_token: accessToken.trim() || undefined,
        shopify_webhook_secret: webhookSecret.trim() || undefined,
        shopify_location_id: (locationId && !locationId.includes('@')) ? locationId.trim() : undefined,
        shopify_api_version: apiVersion,
        sync_enabled: syncEnabled ? 1 : 0
      });

      const res = await api.get('/shopify/locations');
      const locList = res.data?.data || [];
      setLocations(locList);

      if (locList.length > 0) {
        const primary = locList.find(l => l.active) || locList[0];
        setLocationId(String(primary.id));
        addToast(`Found ${locList.length} location(s). Set to "${primary.name}" (ID: ${primary.id})`, 'success');
      } else {
        addToast('No locations found on Shopify store', 'warning');
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to auto-detect locations. Please ensure credentials are saved and valid.', 'error');
    } finally {
      setFetchingLocations(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await api.get('/shopify/test-connection');
      const shop = res.data?.data || {};
      setConnectedShop(shop);
      setSyncStatus('connected');
      addToast(`Connected to Shopify: ${shop.name || shop.myshopify_domain}`, 'success');

      // Auto-fetch locations if none configured
      if (!locationId || locationId.includes('@')) {
        handleFetchLocations();
      }
    } catch (err) {
      setConnectedShop(null);
      setSyncStatus('error');
      addToast(err.response?.data?.message || 'Connection failed. Verify domain and credentials.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncProducts = async () => {
    setSyncingProducts(true);
    try {
      const res = await api.post('/shopify/sync-products');
      const info = res.data?.data || {};
      addToast(`Products Synced: ${info.createdCount} created, ${info.updatedCount} updated (${info.totalProcessed} total)`, 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Product sync failed', 'error');
    } finally {
      setSyncingProducts(false);
    }
  };

  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    try {
      const res = await api.post('/shopify/sync-orders');
      const info = res.data?.data || {};
      addToast(`Orders Synced: ${info.imported} new orders imported from Shopify`, 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Orders sync failed', 'error');
    } finally {
      setSyncingOrders(false);
    }
  };

  const handleSyncInventory = async () => {
    setSyncingInventory(true);
    try {
      const res = await api.post('/shopify/sync-inventory');
      const info = res.data?.data || {};
      addToast(`Inventory Pushed: ${info.synced} variants updated in Shopify`, 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Inventory sync failed', 'error');
    } finally {
      setSyncingInventory(false);
    }
  };

  // Webhook Simulator Actions
  const runSimulation = async (type) => {
    setSimulating(true);
    setSimulationLog(null);

    let topic = '';
    let payload = {};

    const timestamp = Date.now().toString().slice(-4);

    if (type === 'product_created') {
      topic = 'products/create';
      payload = {
        id: parseInt(`9800${timestamp}`, 10),
        title: `A2 Organic Desi Bilona Ghee #${timestamp}`,
        body_html: '<p>Pure, grass-fed A2 Gir Cow cultured ghee prepared via traditional Vedic Bilona method.</p>',
        vendor: 'The Gaav',
        product_type: 'Dairy & Ghee',
        variants: [
          {
            id: parseInt(`4500${timestamp}1`, 10),
            title: '500 ml Glass Jar',
            price: '850.00',
            sku: `TGO-GHEE-500-${timestamp}`,
            inventory_item_id: parseInt(`7800${timestamp}1`, 10),
            inventory_quantity: 60
          },
          {
            id: parseInt(`4500${timestamp}2`, 10),
            title: '1 Litre Glass Jar',
            price: '1600.00',
            sku: `TGO-GHEE-1000-${timestamp}`,
            inventory_item_id: parseInt(`7800${timestamp}2`, 10),
            inventory_quantity: 35
          }
        ]
      };
    } else if (type === 'order_placed') {
      topic = 'orders/create';
      payload = {
        id: parseInt(`6700${timestamp}`, 10),
        order_number: parseInt(`10${timestamp}`, 10),
        name: `#10${timestamp}`,
        created_at: new Date().toISOString(),
        financial_status: 'paid',
        customer: {
          first_name: 'Pooja',
          last_name: 'Verma',
          email: 'pooja.verma@example.com',
          phone: '+91 9811223344'
        },
        shipping_lines: [
          { title: 'Express Delivery', price: '99.00' }
        ],
        line_items: [
          {
            id: parseInt(`8900${timestamp}`, 10),
            title: `A2 Organic Desi Bilona Ghee #${timestamp}`,
            variant_title: '500 ml Glass Jar',
            variant_id: parseInt(`4500${timestamp}1`, 10),
            sku: `TGO-GHEE-500-${timestamp}`,
            quantity: 2,
            price: '850.00',
            total_discount: '0.00'
          }
        ]
      };
    } else if (type === 'inventory_updated') {
      topic = 'inventory_levels/update';
      payload = {
        inventory_item_id: parseInt(`7800${timestamp}1`, 10),
        location_id: 1234567,
        available: 48,
        updated_at: new Date().toISOString()
      };
    }

    try {
      const res = await api.post('/shopify/simulate-webhook', { topic, payload });
      setSimulationLog({
        success: true,
        topic,
        eventId: res.data?.data?.eventId,
        result: res.data?.data?.result,
        timestamp: new Date().toLocaleTimeString()
      });
      addToast(`Simulated "${topic}" webhook processed successfully!`, 'success');
      fetchWebhookEvents();
    } catch (err) {
      setSimulationLog({
        success: false,
        topic,
        error: err.response?.data?.message || err.message,
        timestamp: new Date().toLocaleTimeString()
      });
      addToast('Simulation failed', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleRegisterWebhooks = async () => {
    if (!publicUrl) {
      addToast('Please enter your public HTTPS URL (e.g. from ngrok)', 'warning');
      return;
    }
    setRegistering(true);
    try {
      const formattedUrl = publicUrl.replace(/\/$/, '') + '/api/shopify/webhook';
      const res = await api.post('/shopify/register-webhooks', { callbackUrl: formattedUrl });
      addToast('Webhooks registered on Shopify!', 'success');
      console.log('Registered webhooks:', res.data?.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to register webhooks', 'error');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 rounded-2xl p-6 text-white shadow-xl border border-emerald-800/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-400 text-emerald-950 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              Phase 2 Centralized Shopify Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Shopify Centralized Inventory &amp; Two-Way Sync</h2>
            <p className="text-xs sm:text-sm text-emerald-200 max-w-2xl leading-relaxed">
              Real-time webhook listener, automatic product ingestion, and bidirectional inventory reconciliation. Orders created from WhatsApp, Instagram, or Offline automatically push into Shopify and decrement centralized stock.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${syncStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
              <span className={`h-2 w-2 rounded-full ${syncStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {syncStatus === 'connected' ? 'Shopify Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'settings' ? 'bg-primary-50 text-primary-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Globe className="h-4 w-4" />
          Connection &amp; Operations
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'simulator' ? 'bg-amber-50 text-amber-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Zap className="h-4 w-4" />
          Interactive Webhook Simulator Lab
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'guide' ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <HelpCircle className="h-4 w-4" />
          2026 Dev Dashboard Setup Guide
        </button>
      </div>

      {/* TAB 1: SETTINGS & OPERATIONS */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Credentials form (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveSettings} className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Shopify API Credentials</h3>
                  <p className="text-xs text-gray-500">Supports modern 2026 Client Credentials flow &amp; legacy tokens</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  loading={testing}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Test Connection
                </Button>
              </div>

              {connectedShop && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Connected to <strong>{connectedShop.name}</strong> ({connectedShop.myshopify_domain}) — Currency: {connectedShop.currency}</span>
                  </div>
                  <span className="text-[11px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded font-mono">Plan: {connectedShop.plan_name}</span>
                </div>
              )}

              {/* Mode Selector */}
              <div className="bg-gray-50 p-1.5 rounded-lg flex items-center gap-1 border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setAuthMethod('client_credentials')}
                  className={`flex-1 py-1.5 px-3 rounded-md font-semibold transition-all ${authMethod === 'client_credentials' ? 'bg-white shadow-xs text-primary-700' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  ✨ 2026 Standard: Client ID &amp; Secret (Auto-Refresh)
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('access_token')}
                  className={`flex-1 py-1.5 px-3 rounded-md font-semibold transition-all ${authMethod === 'access_token' ? 'bg-white shadow-xs text-primary-700' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Legacy: Static Access Token (shpat_...)
                </button>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Shopify Domain Name *
                  </label>
                  <div className="relative">
                    <Globe className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="thegaav-organics.myshopify.com"
                      value={domain}
                      onChange={e => setDomain(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Your store's .myshopify.com domain address</p>
                </div>

                {authMethod === 'client_credentials' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Client ID (API Key) *
                      </label>
                      <div className="relative">
                        <Key className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="e.g. 8f29ab0e192..."
                          value={clientId}
                          onChange={e => setClientId(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">From Dev Dashboard app settings</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Client Secret *
                      </label>
                      <div className="relative">
                        <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          placeholder={hasClientSecret ? '•••••••••••••••• (Leave blank to keep)' : 'shpss_... or secret'}
                          value={clientSecret}
                          onChange={e => setClientSecret(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">ERP auto-exchanges this for fresh 24h tokens</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Legacy Admin API Access Token
                    </label>
                    <div className="relative">
                      <Key className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        placeholder={hasAccessToken ? '•••••••••••••••••••••••• (Leave blank to keep)' : 'shpat_xxxxxxxxxxxxxxxxxxxxxxxx'}
                        value={accessToken}
                        onChange={e => setAccessToken(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Permanent token from older pre-2026 custom apps</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Webhook HMAC Secret */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">
                        Webhook HMAC Secret
                      </label>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✨ Optional (Uses Client Secret)
                      </span>
                    </div>
                    <div className="relative">
                      <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        placeholder="Leave blank (auto-uses Client Secret) or shpss_..."
                        value={webhookSecret}
                        onChange={e => setWebhookSecret(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Dev Dashboard apps sign webhooks with your <strong>Client Secret</strong>. You can safely leave this blank!
                    </p>
                  </div>

                  {/* Shopify Primary Location ID */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">
                        Shopify Primary Location ID *
                      </label>
                      <button
                        type="button"
                        onClick={handleFetchLocations}
                        disabled={fetchingLocations}
                        className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 hover:underline inline-flex items-center gap-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${fetchingLocations ? 'animate-spin' : ''}`} />
                        {fetchingLocations ? 'Detecting...' : 'Auto-Detect Location'}
                      </button>
                    </div>
                    <div className="relative">
                      <MapPin className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="e.g. 7812345678"
                        value={locationId}
                        onChange={e => setLocationId(e.target.value)}
                        className={`w-full pl-9 pr-3 py-2 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none ${locationId.includes('@') ? 'border-amber-400 bg-amber-50/50 text-amber-900 font-semibold' : 'border-gray-300'}`}
                      />
                    </div>
                    {locationId.includes('@') ? (
                      <p className="text-[11px] text-amber-600 font-medium mt-1.5 flex items-start gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                        <span>
                          <strong>Email detected!</strong> Shopify Location ID must be numeric (e.g. <code>8912345678</code>), not an email address. Click <strong>Auto-Detect Location</strong> above!
                        </span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">
                        Numeric fulfillment ID where inventory is held. Click &quot;Auto-Detect Location&quot; to fetch automatically.
                      </p>
                    )}

                    {locations.length > 0 && (
                      <div className="mt-2 p-2 bg-primary-50/60 border border-primary-200 rounded-lg">
                        <div className="text-[11px] font-semibold text-primary-900 mb-1">Select from your store&apos;s locations:</div>
                        <select
                          value={locationId}
                          onChange={e => setLocationId(e.target.value)}
                          className="w-full p-1.5 border border-primary-300 rounded text-xs bg-white text-gray-800"
                        >
                          {locations.map(loc => (
                            <option key={loc.id} value={String(loc.id)}>
                              {loc.name} {loc.active ? '(Active)' : '(Inactive)'} — ID: {loc.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncEnabled}
                        onChange={e => setSyncEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                    <span className="text-xs font-medium text-gray-800">Enable Automatic Two-Way Synchronization</span>
                  </div>

                  <Button type="submit" loading={saving} size="sm">
                    Save Configuration
                  </Button>
                </div>
              </div>
            </form>

            {/* Quick Sync Operations */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-gray-900 text-sm border-b pb-2">Manual Synchronization Triggers</h3>
              <p className="text-xs text-gray-500">Run immediate batch synchronization jobs between Shopify and The Gaav ERP</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={handleSyncProducts}
                  disabled={syncingProducts}
                  className="p-4 rounded-xl border border-gray-200 hover:border-primary-400 hover:shadow-xs transition-all text-left bg-gray-50/50 hover:bg-white group"
                >
                  <div className="p-2 bg-primary-100 text-primary-700 rounded-lg w-fit mb-3 group-hover:scale-105 transition-transform">
                    <ArrowDownToLine className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-bold text-gray-900">Pull Products</div>
                  <div className="text-[11px] text-gray-500 mt-1">Imports master products &amp; variants into catalog</div>
                </button>

                <button
                  onClick={handleSyncOrders}
                  disabled={syncingOrders}
                  className="p-4 rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-xs transition-all text-left bg-gray-50/50 hover:bg-white group"
                >
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg w-fit mb-3 group-hover:scale-105 transition-transform">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-bold text-gray-900">Pull Orders</div>
                  <div className="text-[11px] text-gray-500 mt-1">Fetches recent orders &amp; updates contribution</div>
                </button>

                <button
                  onClick={handleSyncInventory}
                  disabled={syncingInventory}
                  className="p-4 rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-xs transition-all text-left bg-gray-50/50 hover:bg-white group"
                >
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg w-fit mb-3 group-hover:scale-105 transition-transform">
                    <ArrowUpFromLine className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-bold text-gray-900">Push Stock</div>
                  <div className="text-[11px] text-gray-500 mt-1">Broadcasts local warehouse stock to Shopify</div>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Architecture & Webhook status summary (1 col) */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-gray-900 text-sm border-b pb-2">2026 OAuth Flow Architecture</h3>
              <div className="space-y-3 text-xs text-gray-600">
                <div className="flex items-start gap-2.5">
                  <div className="p-1 bg-emerald-100 text-emerald-700 rounded mt-0.5">
                    <Check className="h-3 w-3" />
                  </div>
                  <div>
                    <strong className="text-gray-900">Client Credentials Grant:</strong> ERP sends Client ID + Secret to Shopify to receive a 24-hour token.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-1 bg-emerald-100 text-emerald-700 rounded mt-0.5">
                    <Check className="h-3 w-3" />
                  </div>
                  <div>
                    <strong className="text-gray-900">Zero-Touch Token Renewal:</strong> ERP checks token age before every API request and auto-renews it 5 minutes prior to expiry.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-1 bg-emerald-100 text-emerald-700 rounded mt-0.5">
                    <Check className="h-3 w-3" />
                  </div>
                  <div>
                    <strong className="text-gray-900">Centralized Stock Deduction:</strong> Non-Shopify orders push to Shopify with <code>inventory_behaviour: decrement_obeying_policy</code> so Shopify decrements stock.
                  </div>
                </div>
              </div>
            </div>

            {/* Webhook endpoint URL box */}
            <div className="bg-gray-900 text-gray-100 rounded-xl p-5 shadow-xs space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5" />
                  Webhook Gateway URL
                </span>
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded">POST</span>
              </div>
              <p className="text-[11px] text-gray-400">Set this endpoint in your Shopify notifications or ngrok tunnel:</p>
              <div className="bg-black/50 p-2.5 rounded-lg font-mono text-[11px] text-gray-300 break-all select-all border border-gray-800">
                http://localhost:5000/api/shopify/webhook
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE WEBHOOK SIMULATOR LAB */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-950 text-sm mb-0.5">Live Webhook Simulator (No Shopify App Needed)</strong>
              Test both sides of the centralized architecture locally right now! Click any simulation below to dispatch realistic Shopify webhooks directly to the ERP engine and watch the products, inventory, and orders react in real-time.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Simulation 1: Product Created */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs">Simulate: Product Created in Shopify</h4>
                    <span className="text-[10px] text-blue-600 font-mono">topic: products/create</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Sends a realistic new product webhook (A2 Bilona Ghee with 2 variants &amp; initial stock). Verifies that product appears in ERP catalog and inventory balances.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => runSimulation('product_created')}
                loading={simulating}
              >
                Simulate Product Creation
              </Button>
            </div>

            {/* Simulation 2: Order Placed */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs">Simulate: Order Placed in Shopify</h4>
                    <span className="text-[10px] text-emerald-600 font-mono">topic: orders/create</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Simulates a paid order coming from Shopify. Verifies that order is ingested into ERP, contribution margins are calculated, and warehouse inventory is decremented.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => runSimulation('order_placed')}
                loading={simulating}
              >
                Simulate Order Ingestion
              </Button>
            </div>

            {/* Simulation 3: Inventory Updated */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs">Simulate: Shopify Inventory Change</h4>
                    <span className="text-[10px] text-purple-600 font-mono">topic: inventory_levels/update</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Simulates Shopify's stock level updating directly on Shopify Admin. Verifies that ERP updates its synchronized stock level immediately.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => runSimulation('inventory_updated')}
                loading={simulating}
              >
                Simulate Stock Adjustment
              </Button>
            </div>
          </div>

          {/* Simulation Output Card */}
          {simulationLog && (
            <div className={`p-4 rounded-xl border text-xs font-mono transition-all ${simulationLog.success ? 'bg-emerald-950 text-emerald-200 border-emerald-800' : 'bg-red-950 text-red-200 border-red-800'}`}>
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <span className="font-bold flex items-center gap-2">
                  {simulationLog.success ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-red-400" />}
                  Simulation Response [{simulationLog.topic}]
                </span>
                <span className="text-[11px] opacity-75">{simulationLog.timestamp}</span>
              </div>
              <pre className="overflow-x-auto text-[11px] leading-tight">
                {JSON.stringify(simulationLog.result || simulationLog.error, null, 2)}
              </pre>
            </div>
          )}

          {/* Recent Webhook Events Stream */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Recent Webhook Ingestion Log</h3>
                <p className="text-xs text-gray-500">Live ledger of webhooks received from Shopify &amp; the Simulator</p>
              </div>
              <Button size="xs" variant="secondary" onClick={fetchWebhookEvents} loading={loadingEvents}>
                <RefreshCw className="h-3 w-3" />
                Refresh Events
              </Button>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                No webhooks received yet. Click the simulation buttons above to generate test events!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Topic</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Payload Summary</th>
                      <th className="py-2.5 px-3 text-right">Received At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {events.map(ev => (
                      <tr key={ev.id} className="hover:bg-gray-50/80">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500">#{ev.id}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-primary-700">{ev.topic}</td>
                        <td className="py-2.5 px-3">
                          <Badge
                            status={ev.status === 'processed' ? 'active' : ev.status === 'failed' ? 'inactive' : 'pending'}
                            label={ev.status}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-gray-700">
                          {ev.product_title ? `Product: ${ev.product_title.replace(/"/g, '')}` : ev.order_name ? `Order: ${ev.order_name.replace(/"/g, '')}` : `Event ID: ${ev.shopify_event_id}`}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-500">{formatDate(ev.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: 2026 DEV DASHBOARD STEP-BY-STEP SETUP GUIDE */}
      {activeTab === 'guide' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
            <div className="border-b pb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider mb-1">
                2026 Shopify Specification
              </div>
              <h3 className="font-bold text-gray-900 text-base">
                How to Connect via the Shopify Dev Dashboard (Client Credentials Flow)
              </h3>
              <p className="text-xs text-gray-500">
                Shopify retired the old static "Reveal token once" button for new apps. Here is the modern, step-by-step procedure:
              </p>
            </div>

            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center shrink-0 text-xs">
                1
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <h4 className="font-bold text-gray-900 text-sm">Open the Shopify Dev Dashboard</h4>
                <p>
                  Visit <a href="https://shopify.dev/apps" target="_blank" rel="noreferrer" className="text-primary-600 font-semibold underline inline-flex items-center gap-0.5">shopify.dev/apps <ExternalLink className="h-3 w-3" /></a> or your Shopify Partner Dashboard.
                </p>
                <p>Click <strong>Build apps in Dev Dashboard</strong>, then click <strong>Create app</strong>.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center shrink-0 text-xs">
                2
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <h4 className="font-bold text-gray-900 text-sm">App Name &amp; URL Configuration</h4>
                <p>Under <strong>Start from Dev Dashboard</strong>, enter <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-800">The Gaav ERP</code> and click <strong>Create</strong>.</p>
                <p>
                  When prompted for the <strong>App URL</strong>, use:
                  <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-800 ml-1 select-all">https://shopify.dev/apps/default-app-home</code>
                  (since The Gaav ERP runs as an external console and does not need an embedded iframe inside Shopify Admin).
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center shrink-0 text-xs">
                3
              </div>
              <div className="space-y-2 text-xs text-gray-600">
                <h4 className="font-bold text-gray-900 text-sm">Select Webhooks API Version &amp; Access Scopes</h4>
                <p>Select Webhooks API Version <code className="bg-gray-100 px-1 rounded font-mono">2025-01</code> (or latest). Under <strong>Access Scopes</strong>, add:</p>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-[11px] text-gray-800 select-all leading-relaxed">
                  read_products,write_products,read_orders,write_orders,read_inventory,write_inventory,read_locations
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center shrink-0 text-xs">
                4
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <h4 className="font-bold text-gray-900 text-sm">Release &amp; Install App on Your Store</h4>
                <p>Click <strong>Release</strong> and confirm the release.</p>
                <p>In the app's <strong>Installs</strong> section, click <strong>Install app</strong>, select your store (e.g. <code>thegaav-organics.myshopify.com</code>), review permissions, and click <strong>Install</strong>.</p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center shrink-0 text-xs">
                5
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <h4 className="font-bold text-gray-900 text-sm">Copy Client ID &amp; Client Secret into The Gaav ERP</h4>
                <p>From your app's <strong>Settings / Credentials</strong>, copy the <strong>Client ID</strong> and <strong>Client secret</strong>.</p>
                <p>Paste them into the <strong>Connection &amp; Operations</strong> tab in The Gaav ERP.</p>
                <p className="text-emerald-700 font-semibold mt-1">
                  💡 The Gaav ERP will automatically request fresh 24-hour access tokens through the Client Credentials Grant and renew them before expiry. No manual token regeneration needed!
                </p>
              </div>
            </div>

            {/* Step 6: Webhooks via ngrok */}
            <div className="flex gap-4 border-t pt-4">
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                6
              </div>
              <div className="space-y-3 text-xs text-gray-600 flex-1">
                <h4 className="font-bold text-gray-900 text-sm">Expose Local Port 5000 via ngrok for Live Webhooks</h4>
                <p>
                  To receive real-time webhooks (when products are added or orders are placed on Shopify) while developing locally:
                </p>
                <div className="p-3 bg-gray-950 text-emerald-400 font-mono rounded-lg text-xs flex items-center justify-between">
                  <span>ngrok http 5000</span>
                  <span className="text-[10px] text-gray-500">Terminal command</span>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="font-semibold text-gray-900 text-xs">Automated Webhook Registration:</div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://your-domain.ngrok-free.app"
                      value={publicUrl}
                      onChange={e => setPublicUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                    <Button
                      size="sm"
                      onClick={handleRegisterWebhooks}
                      loading={registering}
                    >
                      Register Webhooks
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Registers <code>products/create</code>, <code>products/update</code>, <code>orders/create</code>, and <code>inventory_levels/update</code> on your connected Shopify store automatically!
                  </p>
                </div>
              </div>
            </div>

            {/* Deep Dive: Webhook HMAC Secret & Location ID Decoded */}
            <div className="border-t pt-6 space-y-4">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary-600" />
                Deep Dive: Webhook HMAC Secret &amp; Location ID Decoded
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Webhook HMAC Secret Card */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-emerald-700" />
                    <span className="font-bold text-emerald-950">1. Webhook HMAC Secret</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Shopify signs every webhook request with an <strong>HMAC-SHA256 signature</strong> header (<code>X-Shopify-Hmac-Sha256</code>) so your ERP can verify that the data really came from Shopify and wasn&apos;t intercepted.
                  </p>
                  <div className="space-y-1.5 pt-1 text-gray-700">
                    <div className="p-2 bg-white rounded border border-emerald-200 font-sans">
                      <strong className="text-emerald-900">✨ For Dev Dashboard Apps (2026):</strong><br />
                      Shopify signs requests using your <strong>Client Secret</strong> (API Secret Key). The ERP automatically verifies using the Client Secret you already typed in, so you can <strong>leave the Webhook HMAC Secret field blank</strong>!
                    </div>
                    <div className="p-2 bg-white rounded border border-gray-200 font-sans text-gray-600">
                      <strong className="text-gray-800">For Manual Admin Webhooks:</strong><br />
                      If you manually configure webhooks under <em>Shopify Admin &rarr; Settings &rarr; Notifications &rarr; Webhooks</em>, look at the very bottom of that screen: Shopify shows <code>Your webhooks will be signed with: shpss_...</code>. Copy and paste that string here.
                    </div>
                  </div>
                </div>

                {/* Location ID Card */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-700" />
                    <span className="font-bold text-blue-950">2. Shopify Primary Location ID</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Shopify stores inventory against physical or digital <strong>Locations</strong>. Each location has a unique <strong>numeric ID</strong> (e.g. <code>8491234912</code>).
                  </p>
                  <div className="space-y-1.5 pt-1 text-gray-700">
                    <div className="p-2 bg-amber-50 rounded border border-amber-200 font-sans text-amber-900">
                      <strong>⚠️ Common Mistake:</strong><br />
                      Do not enter an email address (like <code>admin@thegaav.com</code>). Location ID is always numeric!
                    </div>
                    <div className="p-2 bg-white rounded border border-blue-200 font-sans">
                      <strong className="text-blue-900">How to get your Location ID:</strong><br />
                      &bull; <strong>Option A (1-Click):</strong> Click <em>&quot;Auto-Detect Location&quot;</em> in The Gaav ERP.<br />
                      &bull; <strong>Option B (Manual):</strong> In Shopify Admin, open <em>Settings &rarr; Locations</em> &rarr; Click your location. The number at the end of the URL is your Location ID!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
