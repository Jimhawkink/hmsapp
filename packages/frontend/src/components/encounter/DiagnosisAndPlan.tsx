import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Save, X, Star } from 'lucide-react';
import api from '../../api/axios';
import ICD10Search from '../ICD10Search';

interface Props { encounterId: number | string; }

interface Diagnosis {
  icd10_code: string;
  icd10_description: string;
  diagnosis_type: 'Primary' | 'Secondary';
}

export default function DiagnosisAndPlan({ encounterId }: Props) {
  const queryClient = useQueryClient();
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [managementPlan, setManagementPlan] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [referralType, setReferralType] = useState('None');
  const [referralDetails, setReferralDetails] = useState('');

  const { data: existing } = useQuery(
    ['diagnoses', encounterId],
    () => api.get(`/encounters/${encounterId}/diagnoses`).then(r => r.data),
    { enabled: !!encounterId }
  );

  useEffect(() => {
    if (existing && Array.isArray(existing) && existing.length > 0) {
      setDiagnoses(existing.map((d: any) => ({
        icd10_code: d.icd10_code,
        icd10_description: d.icd10_description,
        diagnosis_type: d.diagnosis_type,
      })));
      const primary = existing[0];
      setClinicalNotes(primary.clinical_notes || '');
      setManagementPlan(primary.management_plan || '');
      setFollowUp(primary.follow_up_instructions || '');
      setReferralType(primary.referral_type || 'None');
      setReferralDetails(primary.referral_details || '');
    }
  }, [existing]);

  const saveMutation = useMutation(
    () => {
      if (diagnoses.length === 0) throw new Error('At least one diagnosis required');
      return api.post(`/encounters/${encounterId}/diagnoses`, {
        diagnoses: diagnoses.map(d => ({
          ...d,
          clinical_notes: clinicalNotes,
          management_plan: managementPlan,
          follow_up_instructions: followUp,
          referral_type: referralType,
          referral_details: referralDetails,
        })),
      });
    },
    {
      onSuccess: () => { queryClient.invalidateQueries(['diagnoses', encounterId]); toast.success('Diagnosis & Plan saved'); },
      onError: (err: any) => toast.error(err.message || 'Failed to save'),
    }
  );

  const addDiagnosis = (code: string, description: string) => {
    if (diagnoses.find(d => d.icd10_code === code)) {
      toast.info('Diagnosis already added');
      return;
    }
    const type: 'Primary' | 'Secondary' = diagnoses.length === 0 ? 'Primary' : 'Secondary';
    setDiagnoses(prev => [...prev, { icd10_code: code, icd10_description: description, diagnosis_type: type }]);
  };

  const removeDiagnosis = (code: string) => setDiagnoses(prev => prev.filter(d => d.icd10_code !== code));

  const setPrimary = (code: string) => {
    setDiagnoses(prev => prev.map(d => ({ ...d, diagnosis_type: d.icd10_code === code ? 'Primary' : 'Secondary' })));
  };

  return (
    <div className="space-y-5">
      {/* ICD-10 Search */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">🔍 ICD-10 Diagnosis Search</h3>
          <p className="text-xs text-slate-500 mt-0.5">Type at least 2 characters to search</p>
        </div>
        <div className="p-4">
          <ICD10Search onSelect={addDiagnosis} placeholder="Search by code or condition name (e.g. malaria, J18, hypertension)..." />

          {/* Selected Diagnoses */}
          {diagnoses.length > 0 && (
            <div className="mt-3 space-y-2">
              {diagnoses.map(d => (
                <div key={d.icd10_code}
                  className={`flex items-center justify-between p-3 rounded-xl border ${d.diagnosis_type === 'Primary' ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center gap-2">
                    {d.diagnosis_type === 'Primary' && <Star size={14} className="text-violet-600 fill-violet-600" />}
                    <span className="font-mono text-xs font-bold text-violet-600">{d.icd10_code}</span>
                    <span className="text-sm text-slate-700">{d.icd10_description}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.diagnosis_type === 'Primary' ? 'bg-violet-200 text-violet-800' : 'bg-slate-200 text-slate-600'}`}>
                      {d.diagnosis_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.diagnosis_type !== 'Primary' && (
                      <button onClick={() => setPrimary(d.icd10_code)}
                        className="px-2 py-1 text-xs text-violet-600 hover:bg-violet-100 rounded-lg transition-colors">
                        Set Primary
                      </button>
                    )}
                    <button onClick={() => removeDiagnosis(d.icd10_code)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded-lg">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {diagnoses.length === 0 && (
            <p className="mt-3 text-sm text-slate-400 text-center py-4 border-2 border-dashed border-slate-200 rounded-xl">
              No diagnoses added yet. Search above to add.
            </p>
          )}
        </div>
      </div>

      {/* Clinical Notes & Plan */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">📋 Assessment & Management Plan</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Clinical Assessment / Notes</label>
            <textarea value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} rows={3}
              placeholder="Clinical assessment and reasoning..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Management Plan</label>
            <textarea value={managementPlan} onChange={e => setManagementPlan(e.target.value)} rows={3}
              placeholder="Treatment plan, medications, procedures..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Follow-up Instructions</label>
            <input type="text" value={followUp} onChange={e => setFollowUp(e.target.value)}
              placeholder="e.g. Return in 1 week, review blood results..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Referral</label>
              <select value={referralType} onChange={e => setReferralType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20">
                <option value="None">No Referral</option>
                <option value="Internal">Internal Referral</option>
                <option value="External">External Referral</option>
              </select>
            </div>
            {referralType !== 'None' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Referral Details</label>
                <input type="text" value={referralDetails} onChange={e => setReferralDetails(e.target.value)}
                  placeholder="Department / Facility / Reason..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading || diagnoses.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/25">
          <Save size={16} /> {saveMutation.isLoading ? 'Saving...' : 'Save Diagnosis & Plan'}
        </button>
      </div>
    </div>
  );
}
