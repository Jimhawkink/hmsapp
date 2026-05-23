import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Pill, Clock, CheckCircle, AlertTriangle, X } from 'lucide-react';
import api from '../api/axios';

type Tab = 'queue' | 'history' | 'formulary';

export default function PharmacyPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [dispensedItems, setDispensedItems] = useState<Record<number, boolean>>({});

  const { data: queue, isLoading: queueLoading } = useQuery(
    ['pharmacy-queue'],
    () => api.get('/pharmacy/queue').then(r => r.data),
    { refetchInterval: 30000 }
  );

  const { data: history } = useQuery(
    ['pharmacy-history'],
    () => api.get('/pharmacy/history').then(r => r.data),
    { enabled: activeTab === 'history' }
  );

  const { data: formulary } = useQuery(
    ['pharmacy-formulary'],
    () => api.get('/pharmacy/formulary').then(r => r.data),
    { enabled: activeTab === 'formulary' }
  );

  const { data: rxDetail } = useQuery(
    ['rx-detail', selectedRx?.id],
    () => api.get(`/pharmacy/prescriptions/${selectedRx?.id}`).then(r => r.data),
    { enabled: !!selectedRx?.id }
  );

  const dispenseMutation = useMutation(
    (rxId: number) => api.post(`/pharmacy/prescriptions/${rxId}/dispense`, {
      dispensed_items: (rxDetail?.items || [])
        .filter((item: any) => dispensedItems[item.id])
        .map((item: any) => ({ item_id: item.id, stock_id: item.stock_id, quantity_dispensed: item.quantity_prescribed || 1 })),
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pharmacy-queue']);
        queryClient.invalidateQueries(['pharmacy-history']);
        toast.success('Prescription dispensed successfully');
        setSelectedRx(null);
        setDispensedItems({});
      },
      onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to dispense'),
    }
  );

  const TABS = [
    { key: 'queue' as Tab, label: 'Prescription Queue', icon: <Clock size={15} />, count: (queue || []).length },
    { key: 'history' as Tab, label: 'Dispensing History', icon: <CheckCircle size={15} /> },
    { key: 'formulary' as Tab, label: 'Drug Formulary', icon: <Pill size={15} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">💊</div>
          <div>
            <h1 className="text-2xl font-bold">Pharmacy</h1>
            <p className="text-white/80 text-sm">Prescription dispensing and drug management</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}>
            {tab.icon} {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.key ? 'bg-white/30' : 'bg-red-100 text-red-700'}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Patient</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Prescriber</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Encounter</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Time</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {queueLoading ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">Loading queue...</td></tr>
                ) : (queue || []).length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">✅ No pending prescriptions</td></tr>
                ) : (queue || []).map((rx: any) => (
                  <tr key={rx.id} className="hover:bg-teal-50/30">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{rx.patient_name}</p>
                      <p className="text-xs text-slate-500">{rx.patient_phone}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{rx.prescriber_name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{rx.encounter_number}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {new Date(rx.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => { setSelectedRx(rx); setDispensedItems({}); }}
                        className="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors">
                        Dispense
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Patient</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Prescriber</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Drugs</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Dispensed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(history || []).map((rx: any) => (
                  <tr key={rx.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{rx.patient_name}</td>
                    <td className="px-5 py-3 text-slate-600">{rx.prescriber_name}</td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {(rx.items || []).map((i: any) => i.drug_name).join(', ')}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {new Date(rx.updated_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {(!history || history.length === 0) && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">No dispensing history</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formulary Tab */}
      {activeTab === 'formulary' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Drug Name</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Category</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Stock</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Price (KES)</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(formulary || []).map((drug: any) => (
                  <tr key={drug.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{drug.name}</td>
                    <td className="px-5 py-3 text-slate-600">{drug.category}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${Number(drug.quantity) > 10 ? 'bg-green-100 text-green-700' : Number(drug.quantity) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {drug.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">KES {Number(drug.selling_price || 0).toLocaleString('en-KE')}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{drug.expiry_date || '—'}</td>
                  </tr>
                ))}
                {(!formulary || formulary.length === 0) && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No drugs in formulary</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dispensing Modal */}
      {selectedRx && rxDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-teal-50">
              <div>
                <h3 className="font-bold text-slate-800">Dispense Prescription</h3>
                <p className="text-sm text-slate-600">Patient: <strong>{rxDetail.patient_name}</strong></p>
              </div>
              <button onClick={() => setSelectedRx(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {(rxDetail.items || []).map((item: any) => (
                <div key={item.id} className={`border rounded-xl p-4 transition-all ${dispensedItems[item.id] ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{item.drug_name}</p>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {item.dose} · {item.frequency} · {item.duration} · {item.route}
                      </p>
                      {item.instructions && <p className="text-xs text-slate-500 mt-1">📋 {item.instructions}</p>}
                      {item.stock_id === null && (
                        <div className="flex items-center gap-1 mt-1 text-amber-600 text-xs">
                          <AlertTriangle size={12} /> Not linked to stock
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!dispensedItems[item.id]}
                        onChange={e => setDispensedItems(prev => ({ ...prev, [item.id]: e.target.checked }))}
                        className="w-5 h-5 text-teal-600 rounded" />
                      <span className="text-sm font-medium text-slate-700">Dispensed</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setSelectedRx(null)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => dispenseMutation.mutate(selectedRx.id)}
                disabled={dispenseMutation.isLoading || Object.values(dispensedItems).every(v => !v)}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                <CheckCircle size={14} /> {dispenseMutation.isLoading ? 'Dispensing...' : 'Confirm Dispensing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
