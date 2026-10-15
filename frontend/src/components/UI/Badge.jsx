import React from 'react';

const variants = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
};

const statusMap = {
  confirmed: 'success',
  fulfilled: 'success',
  synced: 'success',
  done: 'success',
  paid: 'success',
  active: 'success',
  in_stock: 'success',
  connected: 'success',
  completed: 'success',
  pending: 'warning',
  processing: 'warning',
  running: 'warning',
  partial: 'warning',
  low_stock: 'warning',
  unpaid: 'warning',
  cancelled: 'error',
  failed: 'error',
  error: 'error',
  refunded: 'error',
  out_of_stock: 'error',
  inactive: 'error',
  draft: 'neutral',
  not_applicable: 'neutral',
  not_configured: 'neutral',
  na: 'neutral',
  shopify: 'purple',
  whatsapp: 'success',
  instagram: 'purple',
};

const Badge = ({ status, label, variant, className = '' }) => {
  const v = variant || (status ? statusMap[status.toLowerCase()] : 'neutral') || 'neutral';
  const text = label || (status ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[v] || variants.neutral} ${className}`}>
      {text}
    </span>
  );
};

export default Badge;
