import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({ message = 'No records found', icon: Icon = Inbox, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="p-3 bg-gray-50 rounded-full mb-3">
      <Icon className="h-10 w-10 text-gray-400" />
    </div>
    <p className="text-sm font-medium text-gray-500 max-w-sm">{message}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
