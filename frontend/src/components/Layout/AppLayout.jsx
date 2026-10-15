import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const titles = {
  '/dashboard': 'Dashboard Overview',
  '/products': 'Product Catalog',
  '/channels': 'Sales Channels',
  '/orders': 'Orders Management',
  '/orders/create': 'Create New Order',
  '/inventory': 'Inventory Tracking',
  '/inventory/movements': 'Stock Movements Ledger',
  '/expenses': 'Overheads & Operating Expenses',
  '/contribution': 'Contribution Margin Analysis',
  '/shopify': 'Shopify Integration',
  '/sync': 'Sync Activity & Jobs',
  '/settings': 'System Settings',
  '/audit': 'Audit Trail & Logs',
};

const AppLayout = () => {
  const { pathname } = useLocation();
  const matchedExact = titles[pathname];
  const matchedPrefix = Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1];
  const title = matchedExact || matchedPrefix || 'The Gaav ERP';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
