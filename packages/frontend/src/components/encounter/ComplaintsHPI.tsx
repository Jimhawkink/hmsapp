import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Save, Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';

interface Complaint {
  id?: number;
  complaint_text: string;
  duration_value: string;
  duration_unit: string;
  comments: string;
}

interface HPIData {
  onset: string;
  character: string;
  radiation: string;
  associated_symptoms: string;
  timing: string;
  exacerbating_factors: string;
  relieving_factors: string;
  narrative: string;
}

interface Props {
  encounterId: number | string;
}

const DURATION_UNITS = ['Hours', 'Days', 'Weeks', 'Months', 'Years'];

export default function ComplaintsHPI({ encounterId }: Props) {
  const queryClient = useQueryClient();

  const [complaints, setComplaints] = useState<Complaint[]>([
    { complaint_text: '', duration_value: '', duration_unit: 'Days', comments: '' }
  ]);

  const [hpi, setHpi] = useState<HPIData>({
    onset: '', character: '', radiation: '', associated_symptoms: '',
    timing: '', exacerbating_factors: '', relieving_factors: '', narrative: ''
  });

  // Load existing HPI
  const { data: existingHPI } = useQuery(
    ['hpi', encounterId],
    () => api.get(`/encounters/${encounterId}/hpi`).then(r => r.data),
    { enabled: !!encounterId }
  );

  // Load existing complaints
  const { data: existingComplaints } = useQuery(
    ['complaints', encounterId],
    () => api.get(`/encounters/${encounterId}/complaints`).then(r => r.data),
    { enabled: !!encounterId }
  );

  useEffect(() => {
    if (existingHPI) {
      setHpi({
        onset: existingHPI.onset || '',
        character: existingHPI.character || '',
        radiation: existingHPI.radiation || '',
        associated_symptoms: existingHPI.associated_symptoms || '',
        timing: existingHPI.timing || '',
        exacerbating_factors: existingHPI.exacerbating_factors || '',
        relieving_factors: existingHPI.relieving_factors || '',
        narrative: existingHPI.narrative || '',
      });
    }
  }, [existingHPI]);

  useEffect(() => {
    if (existingComplaints && existingComplaints.length > 0) {
      setComplaints(existingComplaints.map((c: any) => ({
        id: c.id,
        complaint_text: c.complaint_text || '',
        duration_value: c.duration_value ? String(c.duration_value) : '',
        duration_unit: c.duration_unit || 'Days',
        comments: c.comments || '',
      })));
    }
  }, [existingComplaints]);

  const saveHPIMutation = useMutation(
    () => api.post(`/encounters/${encounterId}/hpi`, hpi),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['hpi', encounterId]);
        toast.success('HPI saved successfully');
      },
      onError: () => toast.error('Failed to save HPI'),
    }
  );

  const saveComplaintsMutation = useMutation(
    () => Promise.all(
      complaints
        .filter(c => c.complaint_text.trim())
        .map(c =>
          api.post(`/encounters/${encounterId}/complaints`, {
            complaint_text: c.complaint_text,
            duration_value: c.duration_value ? parseInt(c.duration_value) : null,
            duration_unit: c.duration_unit,
            comments: c.comments,
          })
        )
    ),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['complaints', encounterId]);
        toast.success('Complaints saved successfully');
      },
      onError: () => toast.error('Failed to save complaints'),
    }
  );

  const addComplaint = () => {
    setComplaints(prev => [...prev, { complaint_text: '', duration_value: '', duration_unit: 'Days', comments: '' }]);
  };

  const removeComplaint = (index: number) => {
    setComplaints(prev => prev.filter((_, i) => i !== index));
  };

  const updateComplaint = (index: number, field: keyof Complaint, value: string) => {
    setComplaints(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleSaveAll = () => {
    saveComplaintsMutation.mutate();
    saveHPIMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Complaints Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            🩺 Chief Complaints
          </h3>
          <button
            onClick={addComplaint}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            <Plus size={14} /> Add Complaint
          </button>
        </div>
        <div className="p-4 space-y-4">
          {complaints.map((complaint, index) => (
            <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Complaint <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={complaint.complaint_text}
                      onChange={e => updateComplaint(index, 'complaint_text', e.target.value)}
                      placeholder="e.g. Fever, Headache, Chest pain..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Duration</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={complaint.duration_value}
                          onChange={e => updateComplaint(index, 'duration_value', e.target.value)}
                          placeholder="e.g. 3"
                          min="0"
                          className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20"
                        />
                        <select
                          value={complaint.duration_unit}
                          onChange={e => updateComplaint(index, 'duration_unit', e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20"
                        >
                          {DURATION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Comments</label>
                      <input
                        type="text"
                        value={complaint.comments}
                        onChange={e => updateComplaint(index, 'comments', e.target.value)}
                        placeholder="Additional notes..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20"
                      />
                    </div>
                  </div>
                </div>
                {complaints.length > 1 && (
                  <button
                    onClick={() => removeComplaint(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-1"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HPI Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">📋 History of Present Illness (HPI)</h3>
          <p className="text-xs text-slate-500 mt-0.5">OLDCARTS framework</p>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'onset', label: 'Onset', placeholder: 'When did it start? Sudden or gradual?' },
            { key: 'character', label: 'Character / Quality', placeholder: 'Sharp, dull, burning, throbbing...' },
            { key: 'radiation', label: 'Radiation / Location', placeholder: 'Does it spread anywhere?' },
            { key: 'associated_symptoms', label: 'Associated Symptoms', placeholder: 'Other symptoms present...' },
            { key: 'timing', label: 'Timing', placeholder: 'Constant, intermittent, worse at night...' },
            { key: 'exacerbating_factors', label: 'Exacerbating Factors', placeholder: 'What makes it worse?' },
            { key: 'relieving_factors', label: 'Relieving Factors', placeholder: 'What makes it better?' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input
                type="text"
                value={(hpi as any)[key]}
                onChange={e => setHpi(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">HPI Narrative</label>
            <textarea
              value={hpi.narrative}
              onChange={e => setHpi(prev => ({ ...prev, narrative: e.target.value }))}
              placeholder="Write a comprehensive narrative of the history of present illness..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveAll}
          disabled={saveHPIMutation.isLoading || saveComplaintsMutation.isLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25"
        >
          <Save size={16} />
          {saveHPIMutation.isLoading ? 'Saving...' : 'Save Complaints & HPI'}
        </button>
      </div>
    </div>
  );
}
