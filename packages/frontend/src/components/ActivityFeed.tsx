import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

const ACTION_ICONS: Record<string, string> = {
  CREATE: '✅', UPDATE: '✏️', DELETE: '🗑️', LOGIN: '🔐', LOGOUT: '🚪', VIEW: '👁️',
};

export default function ActivityFeed() {
  const { data: activity } = useQuery(
    ['dashboard-activity'],
    () => api.get('/dashboard/activity').then(r => r.data),
    { refetchInterval: 30000 }
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800 text-sm">📋 Recent Activity</h3>
      </div>
      <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
        {(!activity || activity.length === 0) ? (
          <div className="px-4 py-6 text-center text-slate-400 text-sm">No recent activity</div>
        ) : (activity || []).map((entry: any) => (
          <div key={entry.id} className="px-4 py-2.5 flex items-start gap-2.5">
            <span className="text-base flex-shrink-0 mt-0.5">{ACTION_ICONS[entry.action_type] || '📌'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-700">
                <span className="font-medium">{entry.user_name || 'System'}</span>
                {' '}{entry.action_type.toLowerCase()}d{' '}
                <span className="font-medium">{entry.resource_name}</span>
                {entry.resource_id ? ` #${entry.resource_id}` : ''}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {new Date(entry.created_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
