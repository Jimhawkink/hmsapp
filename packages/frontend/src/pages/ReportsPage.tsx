import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, Package, Users } from 'lucide-react';
import api from '../api/axios';
import DateRangePicker from '../components/DateRangePicker';
import ExportButtons from '../components/ExportButtons';

const today = new Date().toISOString().split('T')[0];
const startOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

type ReportTab = 'clinical' | 'financial' | 'inventory' | 'patients';

const TABS: { key: ReportTab; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'clinical', label: 'Clinical', icon: <BarChart2 size={16} />, color: 'from-blue-600 to-indigo-600' },
  { key: 'financial', label: 'Financial', icon: <TrendingUp size={16} />, color: 'from-emerald-600 to-teal-600' },
  { key: 'inventory', label: 'Inventory', icon: <Package size={16} />, color: 'from-amber-600 to-orange-600' },
  { key: 'patients', label: 'Patients', icon: <Users size={16} />, color: 'from-violet-600 to-purple-600' },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('clinical');
  const [dateRange, setDateRange] = useState({ from: startOfMonth(), to: today });

  const { data, isLoading, refetch } = useQuery(
    ['report', activeTab, dateRange],
    () => api.get(`/reports/${activeTab}?from=${dateRange.from}&to=${dateRange.to}`).then(r => r.data),
    { keepPreviousData: true }
  );

  const activeTabConfig = TABS.find(t => t.key === activeTab)!;

  const renderClinical = () => {
    if (!data) return null;
    return (
      <div className="space-y-6">
        {/* Provider Workload */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">👨‍⚕️ Provider Workload</h3>
            <ExportButtons data={data.providerWorkload || []} filename="provider_workload" title="Provider Workload Report" dateRange={dateRange}
              columns={[{ key: 'provider_name', label: 'Provider' }, { key: 'job_title', label: 'Title' }, { key: 'encounter_count', label: 'Encounters' }]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Provider</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Title</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Encounters</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(data.providerWorkload || []).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{row.provider_name}</td>
                    <td className="px-5 py-3 text-slate-600">{row.job_title}</td>
                    <td className="px-5 py-3 text-right font-bold text-blue-700">{row.encounter_count}</td>
                  </tr>
                ))}
                {(!data.providerWorkload || data.providerWorkload.length === 0) && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">No data for selected period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Diagnoses */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">🩺 Top 10 Diagnoses</h3>
            <ExportButtons data={data.topDiagnoses || []} filename="top_diagnoses" title="Top Diagnoses Report" dateRange={dateRange}
              columns={[{ key: 'icd10_code', label: 'ICD-10 Code' }, { key: 'icd10_description', label: 'Diagnosis' }, { key: 'count', label: 'Count' }]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">ICD-10</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Diagnosis</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Count</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(data.topDiagnoses || []).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-blue-600">{row.icd10_code}</td>
                    <td className="px-5 py-3 text-slate-700">{row.icd10_description}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">{row.count}</td>
                  </tr>
                ))}
                {(!data.topDiagnoses || data.topDiagnoses.length === 0) && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">No diagnoses recorded for selected period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Encounter Types */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">📋 Encounter Types</h3>
            <ExportButtons data={data.encounterTypes || []} filename="encounter_types" title="Encounter Types Report" dateRange={dateRange}
              columns={[{ key: 'encounter_type', label: 'Type' }, { key: 'count', label: 'Count' }]} />
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {(data.encounterTypes || []).map((row: any, i: number) => (
              <div key={i} className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{row.count}</p>
                <p className="text-sm text-slate-600 mt-1">{row.encounter_type}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderFinancial = () => {
    if (!data) return null;
    const posRevenue = data.posRevenue?.[0] || {};
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white">
            <p className="text-emerald-100 text-sm">Total Revenue</p>
            <p className="text-2xl font-bold mt-1">KES {Number(posRevenue.total_revenue || 0).toLocaleString('en-KE')}</p>
            <p className="text-emerald-200 text-xs mt-1">{posRevenue.total_transactions || 0} transactions</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white">
            <p className="text-amber-100 text-sm">Outstanding Invoices</p>
            <p className="text-2xl font-bold mt-1">KES {Number(data.outstandingInvoices?.[0]?.total || 0).toLocaleString('en-KE')}</p>
            <p className="text-amber-200 text-xs mt-1">{data.outstandingInvoices?.[0]?.count || 0} unpaid</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white">
            <p className="text-blue-100 text-sm">Payment Methods</p>
            <p className="text-2xl font-bold mt-1">{(data.revenueByMethod || []).length}</p>
            <p className="text-blue-200 text-xs mt-1">methods used</p>
          </div>
        </div>

        {/* Revenue by Method */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">💳 Revenue by Payment Method</h3>
            <ExportButtons data={data.revenueByMethod || []} filename="revenue_by_method" title="Revenue by Payment Method" dateRange={dateRange}
              columns={[{ key: 'payment_method', label: 'Method' }, { key: 'transaction_count', label: 'Transactions' }, { key: 'total_revenue', label: 'Revenue (KES)' }]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Method</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Transactions</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Revenue (KES)</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(data.revenueByMethod || []).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{row.payment_method}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{row.transaction_count}</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-700">KES {Number(row.total_revenue || 0).toLocaleString('en-KE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Summary */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">📅 Daily Revenue Summary</h3>
            <ExportButtons data={data.dailySummary || []} filename="daily_revenue" title="Daily Revenue Summary" dateRange={dateRange}
              columns={[{ key: 'sale_date', label: 'Date' }, { key: 'transactions', label: 'Transactions' }, { key: 'revenue', label: 'Revenue (KES)' }]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Date</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Transactions</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Revenue (KES)</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(data.dailySummary || []).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{new Date(row.sale_date).toLocaleDateString('en-KE', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{row.transactions}</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-700">KES {Number(row.revenue || 0).toLocaleString('en-KE')}</td>
                  </tr>
                ))}
                {(!data.dailySummary || data.dailySummary.length === 0) && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">No revenue data for selected period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderInventory = () => {
    if (!data) return null;
    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white">
            <p className="text-amber-100 text-sm">Total Items</p>
            <p className="text-2xl font-bold mt-1">{(data.stockLevels || []).length}</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-5 text-white">
            <p className="text-red-100 text-sm">Low Stock Items</p>
            <p className="text-2xl font-bold mt-1">{(data.lowStock || []).length}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-5 text-white">
            <p className="text-orange-100 text-sm">Expiring Soon</p>
            <p className="text-2xl font-bold mt-1">{(data.expiringItems || []).length}</p>
          </div>
        </div>

        {/* Low Stock Alert */}
        {(data.lowStock || []).length > 0 && (
          <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-red-100 bg-red-50 flex items-center justify-between">
              <h3 className="font-semibold text-red-800">⚠️ Low Stock Alert</h3>
              <ExportButtons data={data.lowStock} filename="low_stock" title="Low Stock Report" dateRange={dateRange}
                columns={[{ key: 'name', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'available_qty', label: 'Qty' }]} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Item</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Category</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Qty</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Price (KES)</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {data.lowStock.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-red-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{row.name}</td>
                      <td className="px-5 py-3 text-slate-600">{row.category}</td>
                      <td className="px-5 py-3 text-right font-bold text-red-600">{row.available_qty}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{Number(row.selling_price || 0).toLocaleString('en-KE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Expiring Items */}
        {(data.expiringItems || []).length > 0 && (
          <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-orange-100 bg-orange-50 flex items-center justify-between">
              <h3 className="font-semibold text-orange-800">⏰ Expiring Within 30 Days</h3>
              <ExportButtons data={data.expiringItems} filename="expiring_items" title="Expiring Items Report" dateRange={dateRange}
                columns={[{ key: 'name', label: 'Item' }, { key: 'available_qty', label: 'Qty' }, { key: 'expiry_date', label: 'Expiry Date' }, { key: 'days_to_expiry', label: 'Days Left' }]} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Item</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Qty</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Expiry Date</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Days Left</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {data.expiringItems.map((row: any, i: number) => (
                    <tr key={i} className={`hover:bg-orange-50 ${Number(row.days_to_expiry) <= 7 ? 'bg-red-50' : ''}`}>
                      <td className="px-5 py-3 font-medium text-slate-800">{row.name}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{row.available_qty}</td>
                      <td className="px-5 py-3 text-slate-600">{new Date(row.expiry_date).toLocaleDateString('en-KE')}</td>
                      <td className={`px-5 py-3 text-right font-bold ${Number(row.days_to_expiry) <= 7 ? 'text-red-600' : 'text-orange-600'}`}>{row.days_to_expiry}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPatients = () => {
    if (!data) return null;
    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-5 text-white">
            <p className="text-violet-100 text-sm">Total Patients</p>
            <p className="text-2xl font-bold mt-1">{data.totalPatients || 0}</p>
          </div>
          {(data.genderBreakdown || []).map((row: any, i: number) => (
            <div key={i} className={`rounded-xl p-5 text-white ${i === 0 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-pink-500 to-rose-600'}`}>
              <p className="text-sm opacity-80">{row.gender} Patients</p>
              <p className="text-2xl font-bold mt-1">{row.count}</p>
            </div>
          ))}
        </div>

        {/* New Registrations */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">📈 New Registrations</h3>
            <ExportButtons data={data.newRegistrations || []} filename="new_registrations" title="New Patient Registrations" dateRange={dateRange}
              columns={[{ key: 'reg_date', label: 'Date' }, { key: 'count', label: 'Registrations' }]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Date</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">New Patients</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(data.newRegistrations || []).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{new Date(row.reg_date).toLocaleDateString('en-KE', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                    <td className="px-5 py-3 text-right font-bold text-violet-700">{row.count}</td>
                  </tr>
                ))}
                {(!data.newRegistrations || data.newRegistrations.length === 0) && (
                  <tr><td colSpan={2} className="px-5 py-8 text-center text-slate-400">No registrations in selected period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* County Breakdown */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">🗺️ Top Counties</h3>
            <ExportButtons data={data.countyBreakdown || []} filename="county_breakdown" title="Patient County Breakdown" dateRange={dateRange}
              columns={[{ key: 'county', label: 'County' }, { key: 'count', label: 'Patients' }]} />
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            {(data.countyBreakdown || []).map((row: any, i: number) => (
              <div key={i} className="bg-violet-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-violet-700">{row.count}</p>
                <p className="text-xs text-slate-600 mt-1">{row.county}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="flex justify-center gap-1 mb-3">
            {[0,1,2].map(i => <div key={i} className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}
          </div>
          <p className="text-slate-500">Loading report data...</p>
        </div>
      </div>
    );
    switch (activeTab) {
      case 'clinical': return renderClinical();
      case 'financial': return renderFinancial();
      case 'inventory': return renderInventory();
      case 'patients': return renderPatients();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`bg-gradient-to-r ${activeTabConfig.color} rounded-2xl p-6 shadow-xl text-white`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">📊</div>
            <div>
              <h1 className="text-2xl font-bold">Reports & Analytics</h1>
              <p className="text-white/80 text-sm">Comprehensive facility performance insights</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? `bg-gradient-to-r ${tab.color} text-white shadow-md`
                : 'text-slate-600 hover:bg-slate-50'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-700 mb-3">📅 Select Period</p>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Report Content */}
      {renderContent()}
    </div>
  );
}
