import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  TrendingUp,
  Globe,
  RefreshCw,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Store,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/channels', icon: Store, label: 'Sales Channels' },
  { to: '/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/inventory', icon: Warehouse, label: 'Inventory' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/contribution', icon: TrendingUp, label: 'Contribution' },
  { to: '/shopify', icon: Globe, label: 'Shopify' },
  { to: '/sync', icon: RefreshCw, label: 'Sync Activity' },
  { to: '/audit', icon: FileText, label: 'Audit Logs', roles: ['admin', 'manager'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredNav = navItems.filter(item => !item.roles || (user?.role && item.roles.includes(user.role)));

  return (
    <aside
      className={`flex flex-col bg-sidebar h-screen sticky top-0 transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      } flex-shrink-0 z-30 select-none shadow-xl`}
    >
      {/* Brand Header */}
      <div className={`flex items-center gap-3 p-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <div className="h-9 w-9 bg-gradient-to-tr from-primary-600 to-indigo-400 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
          <span className="text-white font-extrabold text-base">G</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-white font-bold text-base tracking-wide block leading-tight">The Gaav ERP</span>
            <span className="text-xs text-indigo-300 font-medium tracking-tight">Enterprise Suite</span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scroll">
        {filteredNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Profile & Actions */}
      <div className="border-t border-white/10 p-3 space-y-2">
        {!collapsed && user && (
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/5">
            <p className="text-white text-sm font-semibold truncate">{user.name || user.email}</p>
            <p className="text-indigo-300 text-xs font-medium uppercase tracking-wider mt-0.5 truncate">{user.role || 'User'}</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-link w-full justify-center text-white/50 hover:text-white cursor-pointer py-1.5"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
