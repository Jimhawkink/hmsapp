import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Package, Clock, Calendar } from 'lucide-react';
import api from '../api/axios';

export default function AlertsPanel() {
  const navigate = useNavigate();
  const { data: alerts } = useQuery(
    ['dashboard-alerts'],
    () => api.get('/dashboard/alerts').then(r => r.data),
    { refetchInterval: 60000 }
  );

  if (!alerts) return null;

  const allAlerts = [
    ...(alerts.lowStock || []).map((item: any) => ({
      type: 'low_stock', icon: <Package size={14} />, color: 'text-amber-600 bg-amber-50 border-amber-200',
      message: `Low stock: ${item.name} (${item.quantity} left)`,
      path: '/dashboard/stock-management',
    })),
    ...(alerts.expiringDrugs || []).map((item: any) => ({
      type: 'expiring', icon: <AlertTriangle size={14} />, color: 'text-orange-600 bg-orange-50 border-orange-200',
      message: `Expiring in ${item.days_to_expiry}d: ${item.name}`,
      path: '/dashboard/stock-management',
    })),
    ...(alerts.overdueLabResults || []).map((item: any) => ({
      type: 'lab', icon: <Clock size={14} />, color: 'text-red-600 bg-red-50 border-red-200',
      message: `Lab overdue (${Math.round(item.hours_elapsed)}h): ${item.test_name} — ${item.patient_name}`,
      path: '/dashboard/lab',
    })),
    ...(alerts.overdueAppointments || []).map((item: any) => ({
      type: 'appointment', icon: <Calendar size={14} />, color: 'text-purple-600 bg-purple-50 border-purple-200',
      message: `Missed appointment: ${item.patient_name} on ${new Date(item.appointment_date).toLocaleDateString('en-KE')}`,
      path: '/dashboard/schedule',
    })),
  ];

  if (allAlerts.length === 0) return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-700 text-sm">
      ✅ No alerts — everything looks good!
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-500" /> Alerts
          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">{allAlerts.length}</span>
        </h3>
      </div>
      <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
        {allAlerts.map((alert, i) => (
          <button key={i} onClick={() => navigate(alert.path)}
            className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors border-l-2 ${alert.color}`}>
            <span className="flex-shrink-0">{alert.icon}</span>
            <span className="text-xs">{alert.message}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
