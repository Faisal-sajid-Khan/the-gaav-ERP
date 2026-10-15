import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

const Table = ({ columns, data, loading, emptyMessage = 'No records found', onRowClick }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50/75 border-b border-gray-200">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={`py-3.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.headerClassName || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {data.map((row, i) => (
            <tr
              key={row.id || row._id || i}
              onClick={() => onRowClick && onRowClick(row)}
              className={`hover:bg-gray-50/80 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map(col => (
                <td key={col.key} className={`py-3.5 px-4 text-gray-700 whitespace-nowrap ${col.className || ''}`}>
                  {col.render ? col.render(row[col.key], row, i) : (row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
