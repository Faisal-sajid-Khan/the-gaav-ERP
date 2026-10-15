import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import api from '../api/axios';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const list = res.data?.data || res.data || [];
      setNotifications(Array.isArray(list) ? list : []);
    } catch {
      // silent catch for background polling
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.filter(n => (n.id || n._id) !== id));
    } catch {
      setNotifications(prev => prev.filter(n => (n.id || n._id) !== id));
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none"
        aria-label="View notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-11 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  No notifications
                </div>
              ) : (
                notifications.map(n => {
                  const id = n.id || n._id;
                  return (
                    <div
                      key={id}
                      className={`p-4 hover:bg-gray-50 flex items-start gap-3 transition-colors ${
                        !n.is_read ? 'bg-primary-50/30' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{n.title || 'System Alert'}</p>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{n.message || n.content}</p>
                        {n.created_at && (
                          <p className="text-[10px] text-gray-400 mt-1.5">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => markRead(id)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Mark as read"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
