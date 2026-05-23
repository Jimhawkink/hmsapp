import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Save } from 'lucide-react';
import api from '../../api/axios';

interface Props { encounterId: number | string; }

type FormType = 'ANC' | 'PNC' | 'CWC' | 'FP' | 'HIV_TB';

const FORM_TABS: { key: FormType; label: string; emoji: string }[] = [
  { key: 'ANC', label: 'Antenatal Care', emoji: '🤰' },
  { key: 'PNC', label: 'Postnatal Care', emoji: '👶' },
  { key: 'CWC', label: 'Child Welfare', emoji: '🧒' },
  { key: 'FP', label: 'Family Planning', emoji: '💊' },
  { key: 'HIV_TB', label: 'HIV/TB Screen', emoji: '🔬' },
];

export default function StructuredVisitForms({ encounterId }: Props) {
  const queryClient = useQueryClient();
  const [activeForm, setActiveForm] = useState<FormType>('ANC');
  const [formData, setFormData] = useState<Record<FormType, Record<string, any>>>({
    ANC: { gravida: '', para: '', lmp: '', edd: '', fundal_height: '', fetal_heart_rate: '', presentation: '', position: '' },
    PNC: { delivery_date: '', delivery_type: '', baby_weight: '', breastfeeding: '', lochia: '', uterus_involution: '', notes: '' },
    CWC: { immunisation_bcg: false, immunisation_opv: false, immunisation_dpt: false, immunisation_measles: false, weight_for_age: '', height_for_age: '', muac: '', notes: '' },
    FP: { method: '', last_used: '', next_visit: '', side_effects: '', notes: '' },
    HIV_TB: { hiv_test_result: '', tb_cough: false, tb_fever: false, tb_night_sweats: false, tb_weight_loss: false, referral: '', notes: '' },
  });

  const { data: savedForms } = useQuery(
    ['structured-forms', encounterId],
    () => api.get(`/encounters/${encounterId}/structured-forms`).then(r => r.data),
    { enabled: !!encounterId }
  );

  useEffect(() => {
    if (savedForms && Array.isArray(savedForms)) {
      savedForms.forEach((f: any) => {
        if (f.form_type && f.form_data) {
          setFormData(prev => ({ ...prev, [f.form_type]: typeof f.form_data === 'string' ? JSON.parse(f.form_data) : f.form_data }));
        }
      });
    }
  }, [savedForms]);

  const saveMutation = useMutation(
    () => api.post(`/encounters/${encounterId}/structured-forms`, { form_type: activeForm, form_data: formData[activeForm] }),
    {
      onSuccess: () => { queryClient.invalidateQueries(['structured-forms', encounterId]); toast.success(`${activeForm} form saved`); },
      onError: () => toast.error('Failed to save form'),
    }
  );

  const update = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [activeForm]: { ...prev[activeForm], [key]: value } }));
  };

  const calcEDD = (lmp: string) => {
    if (!lmp) return '';
    const d = new Date(lmp);
    d.setDate(d.getDate() + 280);
    return d.toISOString().split('T')[0];
  };

  const renderANC = () => (
    <div className="grid grid-cols-2 gap-4">
      {[
        { key: 'gravida', label: 'Gravida', type: 'number', placeholder: 'Total pregnancies' },
        { key: 'para', label: 'Para', type: 'number', placeholder: 'Deliveries ≥20 weeks' },
        { key: 'fundal_height', label: 'Fundal Height (cm)', type: 'number', placeholder: 'cm' },
        { key: 'fetal_heart_rate', label: 'Fetal Heart Rate (bpm)', type: 'number', placeholder: 'bpm' },
        { key: 'presentation', label: 'Presentation', type: 'select', options: ['Cephalic','Breech','Transverse','Unknown'] },
        { key: 'position', label: 'Position', type: 'select', options: ['LOA','ROA','LOP','ROP','Unknown'] },
      ].map(f => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
          {f.type === 'select' ? (
            <select value={formData.ANC[f.key] || ''} onChange={e => update(f.key, e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500/20">
              <option value="">Select...</option>
              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input type={f.type} value={formData.ANC[f.key] || ''} onChange={e => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500/20" />
          )}
        </div>
      ))}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">LMP</label>
        <input type="date" value={formData.ANC.lmp || ''} onChange={e => { update('lmp', e.target.value); update('edd', calcEDD(e.target.value)); }}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500/20" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">EDD (auto-calculated)</label>
        <input type="date" value={formData.ANC.edd || ''} readOnly
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
      </div>
    </div>
  );

  const renderPNC = () => (
    <div className="grid grid-cols-2 gap-4">
      {[
        { key: 'delivery_date', label: 'Delivery Date', type: 'date' },
        { key: 'delivery_type', label: 'Delivery Type', type: 'select', options: ['SVD','C-Section','Assisted'] },
        { key: 'baby_weight', label: 'Baby Weight (kg)', type: 'number', placeholder: 'kg' },
        { key: 'breastfeeding', label: 'Breastfeeding', type: 'select', options: ['Exclusive','Mixed','None'] },
        { key: 'lochia', label: 'Lochia', type: 'select', options: ['Normal','Heavy','Offensive','None'] },
        { key: 'uterus_involution', label: 'Uterus Involution', type: 'select', options: ['Good','Poor','Not assessed'] },
      ].map(f => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
          {f.type === 'select' ? (
            <select value={formData.PNC[f.key] || ''} onChange={e => update(f.key, e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500/20">
              <option value="">Select...</option>
              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input type={f.type} value={formData.PNC[f.key] || ''} onChange={e => update(f.key, e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500/20" />
          )}
        </div>
      ))}
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={formData.PNC.notes || ''} onChange={e => update('notes', e.target.value)} rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500/20 resize-none" />
      </div>
    </div>
  );

  const renderCWC = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Immunisation Status</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'immunisation_bcg', label: 'BCG' },
            { key: 'immunisation_opv', label: 'OPV' },
            { key: 'immunisation_dpt', label: 'DPT/Pentavalent' },
            { key: 'immunisation_measles', label: 'Measles/MR' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={!!formData.CWC[key]} onChange={e => update(key, e.target.checked)}
                className="w-4 h-4 text-green-600 rounded" />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: 'weight_for_age', label: 'Weight-for-Age', placeholder: 'Z-score or percentile' },
          { key: 'height_for_age', label: 'Height-for-Age', placeholder: 'Z-score or percentile' },
          { key: 'muac', label: 'MUAC (cm)', placeholder: 'cm' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
            <input type="text" value={formData.CWC[f.key] || ''} onChange={e => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20" />
          </div>
        ))}
      </div>
    </div>
  );

  const renderFP = () => (
    <div className="grid grid-cols-2 gap-4">
      {[
        { key: 'method', label: 'Contraceptive Method', type: 'select', options: ['Pills','Injection (Depo)','Implant','IUD/IUCD','Condoms','Natural','Sterilisation','None'] },
        { key: 'last_used', label: 'Last Used / Started', type: 'date' },
        { key: 'next_visit', label: 'Next Visit Date', type: 'date' },
        { key: 'side_effects', label: 'Side Effects', type: 'text', placeholder: 'Any reported side effects...' },
      ].map(f => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
          {f.type === 'select' ? (
            <select value={formData.FP[f.key] || ''} onChange={e => update(f.key, e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20">
              <option value="">Select...</option>
              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input type={f.type} value={formData.FP[f.key] || ''} onChange={e => update(f.key, e.target.value)}
              placeholder={(f as any).placeholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20" />
          )}
        </div>
      ))}
    </div>
  );

  const renderHIVTB = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">HIV Test Result</label>
        <select value={formData.HIV_TB.hiv_test_result || ''} onChange={e => update('hiv_test_result', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20">
          <option value="">Select...</option>
          <option value="Negative">Negative</option>
          <option value="Positive">Positive</option>
          <option value="Inconclusive">Inconclusive</option>
          <option value="Not Done">Not Done</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">TB Symptom Screen</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'tb_cough', label: 'Cough > 2 weeks' },
            { key: 'tb_fever', label: 'Fever' },
            { key: 'tb_night_sweats', label: 'Night Sweats' },
            { key: 'tb_weight_loss', label: 'Weight Loss' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-red-50">
              <input type="checkbox" checked={!!formData.HIV_TB[key]} onChange={e => update(key, e.target.checked)}
                className="w-4 h-4 text-red-600 rounded" />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Referral Recommendation</label>
        <select value={formData.HIV_TB.referral || ''} onChange={e => update('referral', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20">
          <option value="">Select...</option>
          <option value="None">None required</option>
          <option value="CCC">Refer to CCC (Comprehensive Care Centre)</option>
          <option value="TB_Clinic">Refer to TB Clinic</option>
          <option value="Hospital">Refer to Hospital</option>
        </select>
      </div>
    </div>
  );

  const renderForm = () => {
    switch (activeForm) {
      case 'ANC': return renderANC();
      case 'PNC': return renderPNC();
      case 'CWC': return renderCWC();
      case 'FP': return renderFP();
      case 'HIV_TB': return renderHIVTB();
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {FORM_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveForm(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeForm === tab.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}>
            <span>{tab.emoji}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        {renderForm()}
      </div>

      <div className="flex justify-end">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25">
          <Save size={16} />
          {saveMutation.isLoading ? 'Saving...' : `Save ${FORM_TABS.find(t => t.key === activeForm)?.label}`}
        </button>
      </div>
    </div>
  );
}
