import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Shield, Plus, X, Save, ChevronDown } from 'lucide-react';
import api from '../api/axios';

type Tab = 'claims' | 'schemes';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Paid: 'bg-emerald-100 text-emerald-700',
};

export default function InsurancePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('claims');
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [schemeForm, setSchemeForm] = useState({ scheme_name: '', scheme_code: '', benefit_packages: '[]' });
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');

  const { data: claims, isLoading: claimsLoading } = useQuery(['claims'], () => api.get('/claims').then(r => r.data));
  const { data: schemes } = useQuery(['insurance-schemes'], () => api.get('/insurance/schemes').then(r => r.data));

  const createSchemeMutation = useMutation(
    () => api.post('/insurance/schemes', { ...schemeForm, benefit_packages: JSON.parse(schemeForm.benefit_packages || '[]') }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['insurance-schemes']);
        toast.success('Insurance scheme created');
        setShowSchemeModal(false);
        setSchemeForm({ scheme_name: '', scheme_code: '', benefit_packages: '[]' });
      },
      onError: () => toast.error('Failed to create scheme'),
    }
  );

  const updateStatusMutation = useMutation(
    ({ id, status }: { id: number; status: string }) => api.patch(`/claims/${id}/status`, { status }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['claims']);
        toast.success('Claim status updated');
        setSelectedClaim(null);
      },
      onError: () => toast.error('Failed to update status'),
    }
  );

  const totalClaimed = (claims || []).reduce((s: number, c: any) => s + Number(c.claimed_amount || 0), 0);
  const totalPaid = (claims || []).filter((c: any) => c.status === 'Paid').reduce((s: number, c: any) => s + Number(c.paid_amount || 0), 0);
  const pendingCount = (claims || []).filter((c: any) => ['Draft', 'Submitted'].includes(c.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-700 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🏥</div>
            <div>
              <h1 className="text-2xl font-bold">SHA / NHIF Insurance</h1>
              <p className="text-white/80 text-sm">Claims management and insurance schemes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
          <p className="text-blue-100 text-sm">Total Claimed</p>
          <p className="text-2xl font-bold mt-1">KES {totalClaimed.toLocaleString('en-KE')}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white shadow-lg">
          <p className="text-emerald-100 text-sm">Total Paid</p>
          <p className="text-2xl font-bold mt-1">KES {totalPaid.toLocaleString('en-KE')}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white shadow-lg">
          <p className="text-amber-100 text-sm">Pending Claims</p>
          <p className="text-2xl font-bold mt-1">{pendingCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
        {[{ key: 'claims' as Tab, label: '📋 Claims Management' }, { key: 'schemes' as Tab, label: '🏛️ Insurance Schemes' }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Claims Tab */}
      {activeTab === 'claims' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Patient</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Scheme</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Claim No.</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Claimed (KES)</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-600">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {claimsLoading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Loading claims...</td></tr>
                ) : (claims || []).length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No claims generated yet</td></tr>
                ) : (claims || []).map((claim: any) => (
                  <tr key={claim.id} className="hover:bg-indigo-50/30">
                    <td className="px-5 py-3 font-medium text-slate-800">{claim.patient_name}</td>
                    <td className="px-5 py-3 text-slate-600">{claim.scheme_name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{claim.claim_number}</td>
                    <td className="px-5 py-3 text-right font-bold text-indigo-700">KES {Number(claim.claimed_amount || 0).toLocaleString('en-KE')}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[claim.status] || 'bg-slate-100 text-slate-600'}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <select
                          defaultValue=""
                          onChange={e => { if (e.target.value) updateStatusMutation.mutate({ id: claim.id, status: e.target.value }); }}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20">
                          <option value="">Change status...</option>
                          {['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schemes Tab */}
      {activeTab === 'schemes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowSchemeModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
              <Plus size={16} /> Add Scheme
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(schemes || []).map((scheme: any) => {
              const packages = typeof scheme.benefit_packages === 'string'
                ? JSON.parse(scheme.benefit_packages || '[]') : (scheme.benefit_packages || []);
              return (
                <div key={scheme.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">{scheme.scheme_name}</h3>
                      <p className="text-xs text-slate-500 font-mono">{scheme.scheme_code}</p>
                    </div>
                    <Shield size={20} className="text-indigo-500" />
                  </div>
                  {packages.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 mb-2">Benefit Packages</p>
                      {packages.map((pkg: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{pkg.service}</span>
                          <span className="font-bold text-indigo-700">KES {Number(pkg.limit || 0).toLocaleString('en-KE')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Scheme Modal */}
      {showSchemeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-indigo-50">
              <h3 className="font-bold text-slate-800">Add Insurance Scheme</h3>
              <button onClick={() => setShowSchemeModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Scheme Name <span className="text-red-500">*</span></label>
                  <input type="text" value={schemeForm.scheme_name} onChange={e => setSchemeForm(p => ({ ...p, scheme_name: e.target.value }))}
                    placeholder="e.g. SHA, NHIF, AAR..."
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Scheme Code</label>
                  <input type="text" value={schemeForm.scheme_code} onChange={e => setSchemeForm(p => ({ ...p, scheme_code: e.target.value }))}
                    placeholder="e.g. SHA, NHIF..."
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Benefit Packages (JSON)</label>
                <textarea value={schemeForm.benefit_packages}
                  onChange={e => setSchemeForm(p => ({ ...p, benefit_packages: e.target.value }))} rows={4}
                  placeholder='[{"service":"Consultation","limit":500},{"service":"Inpatient","limit":15000}]'
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono resize-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowSchemeModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => createSchemeMutation.mutate()} disabled={createSchemeMutation.isLoading || !schemeForm.scheme_name}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  <Save size={14} /> {createSchemeMutation.isLoading ? 'Saving...' : 'Save Scheme'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
