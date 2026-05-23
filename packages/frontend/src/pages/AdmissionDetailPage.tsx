import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { ArrowLeft, Plus, LogOut, Printer } from 'lucide-react';
import api from '../api/axios';

export default function AdmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDischargeForm, setShowDischargeForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({ discharge_diagnosis: '', discharge_summary: '' });
  const [noteForm, setNoteForm] = useState({ note_type: 'Ward Round', observations: '' });

  const { data: admission, isLoading } = useQuery(
    ['admission-detail', id],
    () => api.get(`/admissions/${id}`).then(r => r.data),
    { enabled: !!id }
  );

  const dischargeMutation = useMutation(
    () => api.post(`/admissions/${id}/discharge`, dischargeForm),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admissions']);
        toast.success('Patient discharged successfully');
        navigate('/dashboard/admissions');
      },
      onError: () => toast.error('Failed to discharge patient'),
    }
  );

  const addNoteMutation = useMutation(
    () => api.post(`/admissions/${id}/notes`, noteForm),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admission-detail', id]);
        toast.success('Note added');
        setShowNoteForm(false);
        setNoteForm({ note_type: 'Ward Round', observations: '' });
      },
      onError: () => toast.error('Failed to add note'),
    }
  );

  const handlePrintDischargeSummary = () => {
    if (!admission) return;
    const win = window.open('', '_blank', 'width=800,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Discharge Summary</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;max-width:700px;margin:0 auto;}
      h1{font-size:20px;text-align:center;} h2{font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:20px;}
      .row{display:flex;gap:20px;margin-bottom:8px;} .label{font-weight:bold;min-width:160px;font-size:13px;}
      .value{font-size:13px;} @media print{body{padding:0;}}</style></head><body>
      <h1>DISCHARGE SUMMARY</h1>
      <h2>Patient Information</h2>
      <div class="row"><span class="label">Patient Name:</span><span class="value">${admission.patient_name}</span></div>
      <div class="row"><span class="label">Gender:</span><span class="value">${admission.gender || '—'}</span></div>
      <div class="row"><span class="label">Phone:</span><span class="value">${admission.phone || '—'}</span></div>
      <h2>Admission Details</h2>
      <div class="row"><span class="label">Ward:</span><span class="value">${admission.ward_name}</span></div>
      <div class="row"><span class="label">Bed:</span><span class="value">${admission.bed_number}</span></div>
      <div class="row"><span class="label">Admission Date:</span><span class="value">${new Date(admission.admission_date).toLocaleDateString('en-KE')}</span></div>
      <div class="row"><span class="label">Discharge Date:</span><span class="value">${admission.discharge_date ? new Date(admission.discharge_date).toLocaleDateString('en-KE') : new Date().toLocaleDateString('en-KE')}</span></div>
      <div class="row"><span class="label">Admitting Diagnosis:</span><span class="value">${admission.admitting_diagnosis || '—'}</span></div>
      <div class="row"><span class="label">Discharge Diagnosis:</span><span class="value">${admission.discharge_diagnosis || dischargeForm.discharge_diagnosis || '—'}</span></div>
      <h2>Discharge Summary</h2>
      <p style="font-size:13px;">${admission.discharge_summary || dischargeForm.discharge_summary || 'No summary provided.'}</p>
      <div style="margin-top:40px;display:flex;justify-content:space-between;">
        <div><p style="font-size:12px;">Clinician Signature: ________________________</p></div>
        <div><p style="font-size:12px;">Date: ________________________</p></div>
      </div>
      <script>window.onload=function(){window.print();}</script></body></html>`);
    win.document.close();
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="text-slate-400">Loading admission...</div></div>;
  if (!admission) return <div className="text-center py-20 text-slate-400">Admission not found</div>;

  const daysAdmitted = Math.floor((Date.now() - new Date(admission.admission_date).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard/admissions')} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{admission.patient_name}</h1>
              <p className="text-white/80 text-sm">{admission.ward_name} · Bed {admission.bed_number} · {daysAdmitted} days admitted</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrintDischargeSummary}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors">
              <Printer size={14} /> Print Summary
            </button>
            {admission.status === 'Admitted' && (
              <button onClick={() => setShowDischargeForm(!showDischargeForm)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-medium transition-colors">
                <LogOut size={14} /> Discharge
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Patient Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Status', value: admission.status, color: admission.status === 'Admitted' ? 'text-green-700' : 'text-slate-600' },
          { label: 'Admitting Clinician', value: admission.clinician_name },
          { label: 'Admission Date', value: new Date(admission.admission_date).toLocaleDateString('en-KE') },
          { label: 'Days Admitted', value: `${daysAdmitted} days` },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`font-semibold mt-1 ${color || 'text-slate-800'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Admitting Diagnosis */}
      {admission.admitting_diagnosis && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-1">Admitting Diagnosis</p>
          <p className="text-slate-800">{admission.admitting_diagnosis}</p>
        </div>
      )}

      {/* Discharge Form */}
      {showDischargeForm && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-red-800">🚪 Discharge Patient</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Discharge Diagnosis</label>
            <input type="text" value={dischargeForm.discharge_diagnosis}
              onChange={e => setDischargeForm(p => ({ ...p, discharge_diagnosis: e.target.value }))}
              placeholder="Final diagnosis at discharge..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Discharge Summary</label>
            <textarea value={dischargeForm.discharge_summary}
              onChange={e => setDischargeForm(p => ({ ...p, discharge_summary: e.target.value }))} rows={4}
              placeholder="Clinical course, procedures performed, discharge instructions..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-red-500/20" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDischargeForm(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={() => dischargeMutation.mutate()} disabled={dischargeMutation.isLoading}
              className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              <LogOut size={14} /> {dischargeMutation.isLoading ? 'Discharging...' : 'Confirm Discharge'}
            </button>
          </div>
        </div>
      )}

      {/* Ward Notes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">📝 Ward Notes</h3>
          <button onClick={() => setShowNoteForm(!showNoteForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Plus size={14} /> Add Note
          </button>
        </div>

        {showNoteForm && (
          <div className="p-4 border-b border-slate-100 bg-blue-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Note Type</label>
                <select value={noteForm.note_type} onChange={e => setNoteForm(p => ({ ...p, note_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option>Ward Round</option><option>Nursing</option><option>Progress</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observations <span className="text-red-500">*</span></label>
              <textarea value={noteForm.observations} onChange={e => setNoteForm(p => ({ ...p, observations: e.target.value }))} rows={3}
                placeholder="Clinical observations, patient condition, interventions..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNoteForm(false)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-600">Cancel</button>
              <button onClick={() => addNoteMutation.mutate()} disabled={addNoteMutation.isLoading || !noteForm.observations}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {addNoteMutation.isLoading ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {(admission.notes || []).length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">No ward notes yet</div>
          ) : (admission.notes || []).map((note: any) => (
            <div key={note.id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${note.note_type === 'Ward Round' ? 'bg-blue-100 text-blue-700' : note.note_type === 'Nursing' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {note.note_type}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{note.clinician_name || note.staff_name || 'Staff'}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(note.created_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{note.observations}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
