import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Users, Lock, Store, Globe,
  Plus, Check, ShieldCheck, Key, UserCheck, AlertCircle,
  Percent, Trash2, Layers, AlertTriangle, DollarSign
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/UI/Toast';
import Button from '../components/UI/Button';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { formatCurrency } from '../utils/formatters';

export default function Settings() {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Store Settings
  const [storeName, setStoreName] = useState('The Gaav Organics');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [currency, setCurrency] = useState('INR');
  const [savingStore, setSavingStore] = useState(false);

  // Phase 1 MVP Settings
  const [taxRegistered, setTaxRegistered] = useState(false);
  const [taxRatePct, setTaxRatePct] = useState('0'); // percentage: 18% -> 0.18
  const [globalReorderThreshold, setGlobalReorderThreshold] = useState(10);
  const [sharedUnitCosts, setSharedUnitCosts] = useState([]);
  const [newCostName, setNewCostName] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');

  // User Management
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // Password Change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users');
      const list = res.data?.data || res.data || [];
      setUsers(Array.isArray(list) ? list : []);
    } catch {
      setUsers([
        { id: 1, name: user?.name || 'Administrator', email: user?.email || 'admin@thegaav.com', role: 'admin', is_active: true }
      ]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      const s = res.data?.data || res.data;
      if (s) {
        if (s.name || s.store_name) setStoreName(s.name || s.store_name);
        if (s.timezone) setTimezone(s.timezone);
        if (s.currency) setCurrency(s.currency);
        setTaxRegistered(Boolean(s.tax_registered));
        setTaxRatePct(s.tax_rate ? (parseFloat(s.tax_rate) * 100).toString() : '0');
        if (s.global_reorder_threshold) setGlobalReorderThreshold(s.global_reorder_threshold);
        if (Array.isArray(s.shared_unit_costs)) {
          setSharedUnitCosts(s.shared_unit_costs);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchSettings();
    fetchUsers();
  }, []);

  const handleSaveStore = async (e) => {
    if (e) e.preventDefault();
    setSavingStore(true);
    try {
      const payload = {
        name: storeName,
        store_name: storeName,
        timezone,
        currency,
        tax_registered: taxRegistered,
        tax_rate: (parseFloat(taxRatePct) || 0) / 100,
        global_reorder_threshold: parseInt(globalReorderThreshold, 10) || 10,
        shared_unit_costs: sharedUnitCosts
      };

      await api.put('/settings', payload);
      addToast('System and unit-economics settings saved successfully', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update store settings', 'error');
    } finally {
      setSavingStore(false);
    }
  };

  const handleAddCostLine = (e) => {
    e.preventDefault();
    if (!newCostName.trim() || !newCostAmount) {
      addToast('Please enter both name and amount for shared cost line', 'warning');
      return;
    }
    const amountNum = parseFloat(newCostAmount) || 0;
    const newLine = {
      id: Date.now(),
      name: newCostName.trim(),
      amount: amountNum
    };
    const updated = [...sharedUnitCosts, newLine];
    setSharedUnitCosts(updated);
    setNewCostName('');
    setNewCostAmount('');
    addToast(`Added shared cost line: "${newLine.name}" (₹${amountNum.toFixed(2)})`, 'info');
  };

  const handleRemoveCostLine = (id) => {
    const updated = sharedUnitCosts.filter(c => c.id !== id);
    setSharedUnitCosts(updated);
    addToast('Removed shared cost line', 'info');
  };

  const totalSharedUnitCosts = sharedUnitCosts.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      await api.post('/users', newUser);
      addToast(`User ${newUser.email} created`, 'success');
      setIsAddUserOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'staff' });
      fetchUsers();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      addToast('User role updated', 'success');
      fetchUsers();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update user role', 'error');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      addToast('Password must be at least 6 characters long', 'error');
      return;
    }

    setChangingPass(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      addToast('Password updated successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">System Administration & Settings</h2>
        <p className="text-xs text-gray-500">Configure business entity localization, ERP user access, and security</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Settings Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Store className="h-4 w-4 text-primary-600" />
            <h3 className="font-bold text-sm text-gray-900">Entity & Currency Settings</h3>
          </div>

          <form onSubmit={handleSaveStore} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Store / Legal Entity Name</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reporting Timezone</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Base Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-white font-mono focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="AED">AED (د.إ) - UAE Dirham</option>
              </select>
            </div>

            <Button type="submit" loading={savingStore} size="sm" className="w-full justify-center">
              <Check className="h-3.5 w-3.5" />
              Save Entity Configuration
            </Button>
          </form>
        </div>

        {/* Tax Configuration & Inventory Alerts (Phase 1 MVP) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-gray-900">Tax & Inventory Thresholds</h3>
            </div>
            <Badge status={taxRegistered ? 'active' : 'inactive'} />
          </div>

          <form onSubmit={handleSaveStore} className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div>
                <span className="text-xs font-semibold text-gray-900 block">GST / Tax Registered</span>
                <span className="text-[11px] text-gray-500">
                  When false, no tax is stripped from any price regardless of channel setting.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={taxRegistered}
                  onChange={e => setTaxRegistered(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Default GST / Tax Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  disabled={!taxRegistered}
                  value={taxRatePct}
                  onChange={e => setTaxRatePct(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs pr-8 disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="e.g. 18 for 18% GST"
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400 font-bold">%</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Extracted from tax-inclusive prices via: <span className="font-mono text-gray-600">net_billed × tax_rate ÷ (1 + tax_rate)</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Overall Global Reorder Threshold (SKU Units)
              </label>
              <input
                type="number"
                min="0"
                value={globalReorderThreshold}
                onChange={e => setGlobalReorderThreshold(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="10"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Fires inventory low-stock alerts across dashboard and catalog
              </p>
            </div>

            <Button type="submit" loading={savingStore} size="sm" className="w-full justify-center">
              <Check className="h-3.5 w-3.5" />
              Save Tax & Threshold Settings
            </Button>
          </form>
        </div>

        {/* Shared Unit Costs Master (Phase 1 MVP - Formula 1) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-600" />
              <div>
                <h3 className="font-bold text-sm text-gray-900">Shared Unit Costs (Formula 1: Landed Unit Cost)</h3>
                <p className="text-[11px] text-gray-500">
                  Per-unit cost lines applied to every product: <span className="font-mono">landed_cost = mfg_cost + other_direct_cost + SUM(shared_unit_costs)</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Shared Cost</span>
              <span className="text-sm font-black font-mono text-purple-700">{formatCurrency(totalSharedUnitCosts)} / unit</span>
            </div>
          </div>

          {/* Add Cost Line Input */}
          <form onSubmit={handleAddCostLine} className="flex flex-col sm:flex-row items-center gap-3 bg-purple-50/50 p-3 rounded-lg border border-purple-100">
            <div className="flex-1 w-full">
              <input
                type="text"
                value={newCostName}
                onChange={e => setNewCostName(e.target.value)}
                placeholder="Cost line name (e.g. Standard Box, Bubble Wrap, Quality Seal)"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
            <div className="w-full sm:w-36 relative">
              <span className="absolute left-3 top-1.5 text-xs text-gray-400 font-bold">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newCostAmount}
                onChange={e => setNewCostAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" className="w-full sm:w-auto shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Add Cost Line
            </Button>
          </form>

          {/* Cost Lines Table */}
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Cost Line Name</th>
                  <th className="py-2.5 px-3 text-right">Cost Per Unit (₹)</th>
                  <th className="py-2.5 px-3 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sharedUnitCosts.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-4 text-center text-gray-400 italic">
                      No shared unit costs defined. Add lines above to automatically factor packaging/handling into all product landed costs.
                    </td>
                  </tr>
                ) : (
                  sharedUnitCosts.map(line => (
                    <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{line.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{formatCurrency(line.amount)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveCostLine(line.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove cost line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" onClick={() => handleSaveStore()} loading={savingStore} size="sm">
              <Check className="h-3.5 w-3.5" />
              Save All Shared Unit Costs
            </Button>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Lock className="h-4 w-4 text-primary-600" />
            <h3 className="font-bold text-sm text-gray-900">Change Admin Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <Button type="submit" loading={changingPass} size="sm" variant="secondary" className="w-full justify-center">
              <Key className="h-3.5 w-3.5" />
              Update Password
            </Button>
          </form>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-600" />
              Role-Based Access Control & ERP Users
            </h3>
            <p className="text-xs text-gray-500">Manage admins, managers, and operational warehouse staff accounts</p>
          </div>
          <Button size="sm" onClick={() => setIsAddUserOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add ERP User
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b">
              <tr>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Current Role</th>
                <th className="py-2.5 px-3">Change Role</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => {
                const uId = u.id || u._id;
                return (
                  <tr key={uId} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-semibold text-gray-900">{u.name}</td>
                    <td className="py-3 px-3 text-gray-600 font-mono">{u.email}</td>
                    <td className="py-3 px-3">
                      <Badge status={u.role || 'staff'} />
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={u.role || 'staff'}
                        onChange={e => handleChangeRole(uId, e.target.value)}
                        className="px-2 py-1 border rounded text-xs bg-white text-gray-700"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge status={u.is_active !== false ? 'active' : 'inactive'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        title="Create New ERP User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddUserOpen(false)}>
              Cancel
            </Button>
            <Button form="create-user-form" type="submit" loading={creatingUser}>
              Create User
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Priya Nair"
              value={newUser.name}
              onChange={e => setNewUser({ ...newUser, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email Address *</label>
            <input
              type="email"
              required
              placeholder="priya@thegaav.com"
              value={newUser.email}
              onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Initial Password *</label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={newUser.password}
              onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assigned Role</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser({ ...newUser, role: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="staff">Staff (Inventory & Orders View)</option>
              <option value="manager">Manager (Orders, Products & Contribution)</option>
              <option value="admin">Administrator (Full Access & Settings)</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
