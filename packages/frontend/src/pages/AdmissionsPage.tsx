import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Plus, X, Save, Eye } from 'lucide-react';
import api from '../api/axios';

export default function AdmissionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [form, setForm] = useState({ patient_id: '', ward_id: '', bed_id: '', admitting_clinician_id: '', admitting_diagnosis: '', encounter_id: '' });
  const [patientSearch, setPatientSearch] = useState('');

  const { data: admissions, isLoading } = useQuery(['admissions'], () => api.get('/admissions').then(r => r.data), { refetchInterval: 60000 });
  const { data: wards } = useQuery(['wards'], () => api.get('/wards').then(r => r.data));
  const { data: beds } = useQuery(['ward-beds-admit', form.ward_id], () => api.get(`/wards/${form.ward_id}/beds`).then(r => r.data), { enabled: !!form.ward_id });
  const { data: staff } = useQuery(['staff-list'], () => api.get('/staff').then(r => r.data));
  const { data: patients } = useQuery(['patients-search-admit', patientSearch], () => api.get(`/patients?search=${patientSearch}`).then(r => r.data), { enabled: patientSearch.length >= 2 });

  const vacantBeds = (beds || []).filter((b: any) => b.status === 'Vacant');

  const admitMutation = useMutation(
    () => api.post('/admissions', form),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admissions']);
        queryClient.invalidateQueries(['wards']);
        toast.success('Patient admitted successfully');
        setShowAdmitModal(false);
        setForm({ patient_id: '', ward_id: '', bed_id: '', admitting_clinician_id: '', admitting_diagnosis: '', encounter_id: '' });
      },
      onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to admit patient'),
    }
  );

  const calcDays = (admissionDate: string) => {
    const diff = Date.now() - new Date(admissionDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🛏️</div>
            <div>
              <h1 className="text-2xl font-bold">Admissions</h1>
              <p className="text-white/80 text-sm">Inpatient management — {(admissions || []).length} currently admitted</p>
            </div>
          </div>
          <button onClick={() => setShowAdmitModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition-colors shadow-lg">
            <Plus size={16} /> Admit Patient
          </button>
        </div>
      </div>

      {/* Admissions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Patient</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Ward / Bed</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Diagnosis</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Admitted</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Days</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Loading admissions...</td></tr>
              ) : (admissions || []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No active admissions</td></tr>
              ) : (admissions || []).map((adm: any) => (
                <tr key={adm.id} className="hover:bg-blue-50/30">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{adm.patient_name}</p>
                    <p className="text-xs text-slate-500">{adm.gender} · {adm.patient_phone}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-700">{adm.ward_name}</p>
                    <p className="text-xs text-slate-500">Bed: {adm.bed_number}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600 max-w-xs truncate">{adm.admitting_diagnosis || '—'}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {new Date(adm.admission_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${calcDays(adm.admission_date) > 7 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {calcDays(adm.admission_date)}d
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => navigate(`/dashboard/admissions/${adm.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 mx-auto">
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admit Modal */}
      {showAdmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-blue-50">
              <h3 className="font-bold text-slate-800">Admit Patient</h3>
              <button onClick={() => setShowAdmitModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Patient Search */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 mb-1">Search Patient <span className="text-red-500">*</span></label>
                <input type="text" value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Type patient name..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20" />
                {patientSearch.length >= 2 && Array.isArray(patients) && patients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                    {patients.slice(0, 6).map((p: any) => (
                      <button key={p.id} onClick={() => { setForm(prev => ({ ...prev, patient_id: String(p.id) })); setPatientSearch(`${p.firstName || p.first_name} ${p.lastName || p.last_name}`); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-sm">
                        <span className="font-medium">{p.firstName || p.first_name} {p.lastName || p.last_name}</span>
                        <span className="ml-2 text-slate-400 text-xs">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ward <span className="text-red-500">*</span></label>
                  <select value={form.ward_id} onChange={e => setForm(p => ({ ...p, ward_id: e.target.value, bed_id: '' }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Select ward...</option>
                    {(wards || []).map((w: any) => <option key={w.id} value={w.id}>{w.ward_name} ({w.vacant_beds} vacant)</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bed <span className="text-red-500">*</span></label>
                  <select value={form.bed_id} onChange={e => setForm(p => ({ ...p, bed_id: e.target.value }))}
                    disabled={!form.ward_id}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50">
                    <option value="">Select bed...</option>
                    {vacantBeds.map((b: any) => <option key={b.id} value={b.id}>{b.bed_number}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Admitting Clinician <span className="text-red-500">*</span></label>
                <select value={form.admitting_clinician_id} onChange={e => setForm(p => ({ ...p, admitting_clinician_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Select clinician...</option>
                  {(staff || []).map((s: any) => <option key={s.id} value={s.id}>{s.title} {s.first_name || s.firstName} {s.last_name || s.lastName}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Admitting Diagnosis</label>
                <textarea value={form.admitting_diagnosis} onChange={e => setForm(p => ({ ...p, admitting_diagnosis: e.target.value }))} rows={2}
                  placeholder="Primary diagnosis for admission..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowAdmitModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => admitMutation.mutate()}
                disabled={admitMutation.isLoading || !form.patient_id || !form.ward_id || !form.bed_id || !form.admitting_clinician_id}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save size={14} /> {admitMutation.isLoading ? 'Admitting...' : 'Admit Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
