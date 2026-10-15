import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/Layout/AppLayout';

// Page Components
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import SalesChannels from './pages/SalesChannels';
import Orders from './pages/Orders';
import CreateOrder from './pages/CreateOrder';
import OrderDetail from './pages/OrderDetail';
import Inventory from './pages/Inventory';
import InventoryMovements from './pages/InventoryMovements';
import Expenses from './pages/Expenses';
import ContributionAnalysis from './pages/ContributionAnalysis';
import ShopifyIntegration from './pages/ShopifyIntegration';
import SyncActivity from './pages/SyncActivity';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected ERP Application Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/channels" element={<SalesChannels />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/create" element={<CreateOrder />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/movements" element={<InventoryMovements />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/contribution" element={<ContributionAnalysis />} />
        <Route path="/shopify" element={<ShopifyIntegration />} />
        <Route path="/sync" element={<SyncActivity />} />

        {/* Admin & Manager Only Routes */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback Redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
