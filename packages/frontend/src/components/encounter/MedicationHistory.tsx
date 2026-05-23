import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';

interface Props { patientId: number | string; }

interface Medication { drug_name: string; dose: string; frequency: string; duration: string; indication: string; }
interface Allergy { id?: number; allergen: string; allergy_type: string; reaction_type: string; severity: string; }

export default function MedicationHistory({ patientId }: Props) {
  const queryClient = useQueryClient();

  const [medications, setMedications] = useState<Medication[]>([{ drug_name: '', dose: '', frequency: '', duration: '', indication: '' }]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [newAllergy, setNewAllergy] = useState<Allergy>({ allergen: '', allergy_type: 'Drug', reaction_type: '', severity: 'Mild' });
  const [pastMedical, setPastMedical] = useState('');
  const [surgical, setSurgical] = useState('');
  const [family, setFamily] = useState('');
  const [social, setSocial] = useState({ smoking: '', alcohol: '', occupation: '' });

  const { data: history } = useQuery(['med-history', patientId], () => api.get(`/patients/${patientId}/medication-history`).then(r => r.data), { enabled: !!patientId });
  const { data: allergyList, refetch: refetchAllergies } = useQuery(['allergies', patientId], () => api.get(`/patients/${patientId}/allergies`).then(r => r.data), { enabled: !!patientId });

  useEffect(() => {
    if (history) {
      const meds = typeof history.current_medications === 'string' ? JSON.parse(history.current_medications) : (history.current_medications || []);
      if (meds.length > 0) setMedications(meds);
      setPastMedical(history.past_medical_history || '');
      setSurgical(history.surgical_history || '');
      setFamily(history.family_history || '');
      const sh = typeof history.social_history === 'string' ? JSON.parse(history.social_history) : (history.social_history || {});
      setSocial({ smoking: sh.smoking || '', alcohol: sh.alcohol || '', occupation: sh.occupation || '' });
    }
  }, [history]);

  useEffect(() => { if (allergyList) setAllergies(allergyList); }, [allergyList]);

  const saveMutation = useMutation(
    () => api.post(`/patients/${patientId}/medication-history`, {
      current_medications: medications.filter(m => m.drug_name.trim()),
      past_medical_history: pastMedical, surgical_history: surgical,
      family_history: family, social_history: social,
    }),
    { onSuccess: () => { queryClient.invalidateQueries(['med-history', patientId]); toast.success('Medication history saved'); }, onError: () => toast.error('Failed to save') }
  );

  const addAllergyMutation = useMutation(
    () => api.post(`/patients/${patientId}/allergies`, newAllergy),
    { onSuccess: () => { refetchAllergies(); setNewAllergy({ allergen: '', allergy_type: 'Drug', reaction_type: '', severity: 'Mild' }); toast.success('Allergy added'); }, onError: () => toast.error('Failed to add allergy') }
  );

  const deleteAllergyMutation = useMutation(
    (allergyId: number) => api.delete(`/patients/${patientId}/allergies/${allergyId}`),
    { onSuccess: () => { refetchAllergies(); toast.success('Allergy removed'); } }
  );

  const hasSevereAllergy = allergies.some((a: any) => a.severity === 'Severe');

  return (
    <div className="space-y-6">
      {/* Severe Allergy Alert */}
      {hasSevereAllergy && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-400 rounded-xl">
          <AlertTriangle className="text-red-600 flex-shrink-0" size={24} />
          <div>
            <p className="font-bold text-red-700">⚠️ SEVERE ALLERGY ALERT</p>
            <p className="text-sm text-red-600">
              {allergies.filter((a: any) => a.severity === 'Severe').map((a: any) => a.allergen).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Allergies */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-red-50 px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">🚨 Allergies</h3>
        </div>
        <div className="p-4 space-y-3">
          {allergies.map((a: any) => (
            <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border ${a.severity === 'Severe' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
              <div>
                <span className="font-medium text-slate-800">{a.allergen}</span>
                <span className="ml-2 text-xs text-slate-500">{a.allergy_type}</span>
                {a.reaction_type && <span className="ml-2 text-xs text-slate-500">→ {a.reaction_type}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.severity === 'Severe' ? 'bg-red-200 text-red-800' : a.severity === 'Moderate' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.severity}</span>
                <button onClick={() => deleteAllergyMutation.mutate(a.id)} className="p-1 text-red-500 hover:bg-red-100 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            <input type="text" value={newAllergy.allergen} onChange={e => setNewAllergy(p => ({ ...p, allergen: e.target.value }))} placeholder="Allergen *" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <select value={newAllergy.allergy_type} onChange={e => setNewAllergy(p => ({ ...p, allergy_type: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option>Drug</option><option>Food</option><option>Environmental</option><option>Other</option>
            </select>
            <input type="text" value={newAllergy.reaction_type} onChange={e => setNewAllergy(p => ({ ...p, reaction_type: e.target.value }))} placeholder="Reaction" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <div className="flex gap-2">
              <select value={newAllergy.severity} onChange={e => setNewAllergy(p => ({ ...p, severity: e.target.value }))} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option>Mild</option><option>Moderate</option><option>Severe</option>
              </select>
              <button onClick={() => newAllergy.allergen && addAllergyMutation.mutate()} className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"><Plus size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Current Medications */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">💊 Current Medications</h3>
          <button onClick={() => setMedications(p => [...p, { drug_name: '', dose: '', frequency: '', duration: '', indication: '' }])} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus size={14} /> Add</button>
        </div>
        <div className="p-4 space-y-3">
          {medications.map((med, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 items-center">
              <input type="text" value={med.drug_name} onChange={e => setMedications(p => p.map((m, j) => j === i ? { ...m, drug_name: e.target.value } : m))} placeholder="Drug name *" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input type="text" value={med.dose} onChange={e => setMedications(p => p.map((m, j) => j === i ? { ...m, dose: e.target.value } : m))} placeholder="Dose" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input type="text" value={med.frequency} onChange={e => setMedications(p => p.map((m, j) => j === i ? { ...m, frequency: e.target.value } : m))} placeholder="Frequency" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input type="text" value={med.indication} onChange={e => setMedications(p => p.map((m, j) => j === i ? { ...m, indication: e.target.value } : m))} placeholder="Indication" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <button onClick={() => setMedications(p => p.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* History Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: '🏥 Past Medical History', value: pastMedical, setter: setPastMedical },
          { label: '🔪 Surgical History', value: surgical, setter: setSurgical },
          { label: '👨‍👩‍👧 Family History', value: family, setter: setFamily },
        ].map(({ label, value, setter }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
            <textarea value={value} onChange={e => setter(e.target.value)} rows={3} placeholder="Enter details..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        ))}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">🌍 Social History</label>
          <div className="space-y-2">
            {[
              { key: 'smoking', label: 'Smoking', placeholder: 'Never / Ex-smoker / Current (X packs/day)' },
              { key: 'alcohol', label: 'Alcohol', placeholder: 'None / Occasional / Regular' },
              { key: 'occupation', label: 'Occupation', placeholder: 'Current occupation' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-0.5">{label}</label>
                <input type="text" value={(social as any)[key]} onChange={e => setSocial(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25">
          <Save size={16} /> {saveMutation.isLoading ? 'Saving...' : 'Save Medication History'}
        </button>
      </div>
    </div>
  );
}
