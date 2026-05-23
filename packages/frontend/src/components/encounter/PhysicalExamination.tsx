import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Save } from 'lucide-react';
import api from '../../api/axios';

interface Props { encounterId: number | string; patientId: number | string; }

const SYSTEMS = [
  { key: 'general_appearance', label: 'General Appearance', icon: '🧍', placeholder: 'Alert, oriented, well-nourished, no acute distress...' },
  { key: 'heent', label: 'HEENT', icon: '👁️', placeholder: 'Head normocephalic, eyes PERRL, ears clear, throat clear...' },
  { key: 'neck', label: 'Neck', icon: '🦒', placeholder: 'Supple, no lymphadenopathy, no JVD, trachea midline...' },
  { key: 'chest_lungs', label: 'Chest / Lungs', icon: '🫁', placeholder: 'Clear to auscultation bilaterally, no wheezes/crackles...' },
  { key: 'heart', label: 'Heart', icon: '❤️', placeholder: 'Regular rate and rhythm, S1 S2 normal, no murmurs...' },
  { key: 'abdomen', label: 'Abdomen', icon: '🫃', placeholder: 'Soft, non-tender, non-distended, bowel sounds present...' },
  { key: 'extremities', label: 'Extremities', icon: '🦵', placeholder: 'No oedema, pulses intact, no cyanosis or clubbing...' },
  { key: 'neurological', label: 'Neurological', icon: '🧠', placeholder: 'Alert and oriented x3, cranial nerves intact, no focal deficits...' },
  { key: 'skin', label: 'Skin', icon: '🩹', placeholder: 'Warm, dry, intact, no rashes or lesions...' },
];

type ExamData = Record<string, { normal: boolean; findings: string }>;

export default function PhysicalExamination({ encounterId, patientId }: Props) {
  const queryClient = useQueryClient();
  const [examData, setExamData] = useState<ExamData>(
    Object.fromEntries(SYSTEMS.map(s => [s.key, { normal: true, findings: '' }]))
  );

  // Load latest triage vitals
  const { data: triageData } = useQuery(
    ['triage-latest', patientId],
    () => api.get(`/triage?patientId=${patientId}&limit=1`).then(r => Array.isArray(r.data) ? r.data[0] : r.data),
    { enabled: !!patientId }
  );

  // Load existing examination
  const { data: existing } = useQuery(
    ['examination', encounterId],
    () => api.get(`/encounters/${encounterId}/examination`).then(r => r.data),
    { enabled: !!encounterId }
  );

  useEffect(() => {
    if (existing) {
      const newData: ExamData = { ...Object.fromEntries(SYSTEMS.map(s => [s.key, { normal: true, findings: '' }])) };
      SYSTEMS.forEach(s => {
        const val = (existing as any)[s.key];
        if (val) newData[s.key] = { normal: false, findings: val };
      });
      setExamData(newData);
    }
  }, [existing]);

  const saveMutation = useMutation(
    () => {
      const payload: Record<string, any> = {};
      SYSTEMS.forEach(s => {
        payload[s.key] = examData[s.key].normal ? null : examData[s.key].findings;
      });
      return api.post(`/encounters/${encounterId}/examination`, payload);
    },
    {
      onSuccess: () => { queryClient.invalidateQueries(['examination', encounterId]); toast.success('Physical examination saved'); },
      onError: () => toast.error('Failed to save examination'),
    }
  );

  const toggle = (key: string) => {
    setExamData(prev => ({ ...prev, [key]: { ...prev[key], normal: !prev[key].normal, findings: prev[key].normal ? '' : prev[key].findings } }));
  };

  const abnormalCount = Object.values(examData).filter(v => !v.normal).length;

  return (
    <div className="space-y-4">
      {/* Vitals Summary from Triage */}
      {triageData && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-blue-800 mb-3">📊 Latest Vitals (from Triage)</h4>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Temp', value: triageData.temperature ? `${triageData.temperature}°C` : '—' },
              { label: 'HR', value: triageData.heart_rate ? `${triageData.heart_rate} bpm` : '—' },
              { label: 'BP', value: triageData.blood_pressure || '—' },
              { label: 'RR', value: triageData.respiratory_rate ? `${triageData.respiratory_rate}/min` : '—' },
              { label: 'SpO₂', value: triageData.blood_oxygenation ? `${triageData.blood_oxygenation}%` : '—' },
              { label: 'Weight', value: triageData.weight ? `${triageData.weight} kg` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-blue-600 font-medium">{label}</p>
                <p className="text-sm font-bold text-blue-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex gap-3 text-sm">
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">✓ {SYSTEMS.length - abnormalCount} Normal</span>
        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">⚠ {abnormalCount} Abnormal</span>
      </div>

      {/* Systems */}
      <div className="space-y-2">
        {SYSTEMS.map(system => {
          const data = examData[system.key];
          return (
            <div key={system.key}
              className={`border rounded-xl p-3 transition-all ${!data.normal ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-3">
                <span className="text-lg w-7 text-center">{system.icon}</span>
                <span className="font-medium text-slate-800 w-40 text-sm">{system.label}</span>
                <div className="flex gap-2 flex-1">
                  <button onClick={() => !data.normal && toggle(system.key)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${data.normal ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    ✓ Normal
                  </button>
                  <button onClick={() => data.normal && toggle(system.key)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${!data.normal ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    ⚠ Abnormal
                  </button>
                </div>
              </div>
              {!data.normal && (
                <div className="mt-2 ml-10">
                  <textarea
                    value={data.findings}
                    onChange={e => setExamData(prev => ({ ...prev, [system.key]: { ...prev[system.key], findings: e.target.value } }))}
                    placeholder={system.placeholder}
                    rows={2}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 bg-white resize-none"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25">
          <Save size={16} /> {saveMutation.isLoading ? 'Saving...' : 'Save Examination'}
        </button>
      </div>
    </div>
  );
}
