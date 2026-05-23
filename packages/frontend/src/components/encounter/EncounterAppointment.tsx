import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Calendar, Save } from 'lucide-react';
import api from '../../api/axios';

interface Props {
  encounterId: number | string;
  patientId: number | string;
  patientName: string;
}

export default function EncounterAppointment({ encounterId, patientId, patientName }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    provider_id: '',
    appointment_date: '',
    appointment_time: '',
    appointment_type_id: '',
    notes: '',
    reason_for_visit: '',
  });
  const [conflictWarning, setConflictWarning] = useState('');

  const { data: staff } = useQuery(['staff-list'], () => api.get('/staff').then(r => r.data));
  const { data: apptTypes } = useQuery(['appointment-types'], () => api.get('/appointment-types').then(r => r.data));

  const saveMutation = useMutation(
    () => api.post(`/encounters/${encounterId}/appointments`, { ...form, patient_id: patientId }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['appointments']);
        toast.success('Follow-up appointment booked successfully');
        setForm({ provider_id: '', appointment_date: '', appointment_time: '', appointment_type_id: '', notes: '', reason_for_visit: '' });
        setConflictWarning('');
      },
      onError: (err: any) => {
        if (err?.response?.status === 409) {
          setConflictWarning('This time slot is already booked for the selected provider. Please choose a different time.');
        } else {
          toast.error('Failed to book appointment');
        }
      },
    }
  );

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setConflictWarning('');
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Calendar size={16} className="text-blue-600" /> Book Follow-up Appointment
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Patient: <strong>{patientName}</strong></p>
        </div>

        <div className="p-4 space-y-4">
          {conflictWarning && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-700">
              ⚠️ {conflictWarning}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provider <span className="text-red-500">*</span></label>
              <select value={form.provider_id} onChange={e => update('provider_id', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20">
                <option value="">Select provider...</option>
                {Array.isArray(staff) && staff.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.title} {s.first_name || s.firstName} {s.last_name || s.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Appointment Type</label>
              <select value={form.appointment_type_id} onChange={e => update('appointment_type_id', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20">
                <option value="">Select type...</option>
                {Array.isArray(apptTypes) && apptTypes.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.appointment_date} min={minDate}
                onChange={e => update('appointment_date', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Time <span className="text-red-500">*</span></label>
              <input type="time" value={form.appointment_time}
                onChange={e => update('appointment_time', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason for Visit</label>
            <input type="text" value={form.reason_for_visit} onChange={e => update('reason_for_visit', e.target.value)}
              placeholder="e.g. Follow-up for hypertension management..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isLoading || !form.provider_id || !form.appointment_date || !form.appointment_time}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25">
          <Save size={16} /> {saveMutation.isLoading ? 'Booking...' : 'Book Appointment'}
        </button>
      </div>
    </div>
  );
}
