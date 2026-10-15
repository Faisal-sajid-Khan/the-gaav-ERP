import React from 'react';
import NotificationBell from '../NotificationBell';
import { useAuth } from '../../context/AuthContext';

const Header = ({ title }) => {
  const { user } = useAuth();
  const initial = user?.name ? user.name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : 'U');

  return (
    <header className="bg-white border-b border-gray-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="h-6 w-px bg-gray-200 hidden sm:block" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-primary-100 text-primary-700 ring-2 ring-primary-500/20 rounded-full flex items-center justify-center font-bold text-sm shadow-xs">
            {initial}
          </div>
          <div className="hidden sm:block text-left">
            <span className="text-sm font-semibold text-gray-800 block leading-tight">{user?.name || user?.email}</span>
            <span className="text-xs text-gray-500 capitalize">{user?.role || 'Staff'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
