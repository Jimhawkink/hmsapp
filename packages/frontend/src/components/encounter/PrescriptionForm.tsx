import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Save, Plus, Trash2, Printer, Search, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';

interface Props {
  encounterId: number | string;
  patientId: number | string;
  prescriberId: number | string;
  patientName?: string;
  prescriberName?: string;
  facilityName?: string;
}

interface DrugItem {
  drug_name: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  quantity_prescribed: number;
  stock_id?: string;
  available_qty?: number;
}

const ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled', 'Sublingual', 'Rectal', 'Nasal', 'Ophthalmic'];
const FREQUENCIES = ['Once daily (OD)', 'Twice daily (BD)', 'Three times daily (TDS)', 'Four times daily (QID)', 'Every 8 hours', 'Every 6 hours', 'Every 4 hours', 'At night (ON)', 'As needed (PRN)', 'Stat (once)'];

export default function PrescriptionForm({ encounterId, patientId, prescriberId, patientName = 'Patient', prescriberName = 'Clinician', facilityName = 'Hospital' }: Props) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<DrugItem[]>([{ drug_name: '', dose: '', frequency: 'Twice daily (BD)', duration: '5 Days', route: 'Oral', instructions: '', quantity_prescribed: 1 }]);
  const [notes, setNotes] = useState('');
  const [drugSearch, setDrugSearch] = useState('');
  const [drugResults, setDrugResults] = useState<any[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: existingRx } = useQuery(
    ['prescriptions', encounterId],
    () => api.get(`/encounters/${encounterId}/prescriptions`).then(r => r.data),
    { enabled: !!encounterId }
  );

  useEffect(() => {
    if (existingRx && existingRx.length > 0) {
      const latest = existingRx[0];
      if (latest.items?.length > 0) {
        setItems(latest.items.map((i: any) => ({
          drug_name: i.drug_name, dose: i.dose || '', frequency: i.frequency || 'Twice daily (BD)',
          duration: i.duration || '5 Days', route: i.route || 'Oral',
          instructions: i.instructions || '', quantity_prescribed: i.quantity_prescribed || 1,
          stock_id: i.stock_id,
        })));
        setNotes(latest.notes || '');
      }
    }
  }, [existingRx]);

  // Drug search
  useEffect(() => {
    if (!drugSearch || drugSearch.length < 2) { setDrugResults([]); return; }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await api.get(`/stock?search=${encodeURIComponent(drugSearch)}&limit=10`);
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setDrugResults(data);
      } catch { setDrugResults([]); }
    }, 300);
  }, [drugSearch]);

  const selectDrug = (drug: any, index: number) => {
    setItems(prev => prev.map((item, i) => i === index ? {
      ...item,
      drug_name: drug.name || drug.productName || drug.product_name || '',
      stock_id: drug.id,
      available_qty: drug.quantity || drug.availableqty || 0,
    } : item));
    setDrugSearch('');
    setDrugResults([]);
    setActiveItemIndex(null);
  };

  const saveMutation = useMutation(
    () => api.post(`/encounters/${encounterId}/prescriptions`, {
      patient_id: patientId, prescriber_id: prescriberId, notes,
      items: items.filter(i => i.drug_name.trim()),
    }),
    {
      onSuccess: () => { queryClient.invalidateQueries(['prescriptions', encounterId]); toast.success('Prescription saved'); },
      onError: () => toast.error('Failed to save prescription'),
    }
  );

  const handlePrint = () => {
    const validItems = items.filter(i => i.drug_name.trim());
    if (validItems.length === 0) { toast.error('Add at least one drug before printing'); return; }

    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return;

    const itemsHtml = validItems.map((item, i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${i + 1}. <strong>${item.drug_name}</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.dose}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.frequency}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.duration}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.route}</td>
      </tr>
      ${item.instructions ? `<tr><td colspan="5" style="padding:4px 8px 8px;font-size:12px;color:#666;border-bottom:1px solid #eee;">Instructions: ${item.instructions}</td></tr>` : ''}
    `).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>Prescription</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;}
      .header{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px;}
      table{width:100%;border-collapse:collapse;}th{background:#f5f5f5;padding:8px;text-align:left;font-size:13px;}
      .footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px;font-size:12px;}
      @media print{body{padding:0;}}</style></head><body>
      <div class="header">
        <h2 style="margin:0;">${facilityName}</h2>
        <p style="margin:4px 0;font-size:14px;font-weight:bold;">PRESCRIPTION</p>
        <p style="margin:2px 0;font-size:12px;">Date: ${new Date().toLocaleDateString('en-KE')}</p>
      </div>
      <p><strong>Patient:</strong> ${patientName}</p>
      <p><strong>Prescriber:</strong> ${prescriberName}</p>
      <table><thead><tr><th>Drug</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Route</th></tr></thead>
      <tbody>${itemsHtml}</tbody></table>
      ${notes ? `<p style="margin-top:15px;"><strong>Notes:</strong> ${notes}</p>` : ''}
      <div class="footer">
        <p>Prescriber Signature: ________________________</p>
        <p style="font-size:11px;color:#666;">This prescription is valid for 30 days from the date of issue.</p>
      </div>
      <script>window.onload=function(){window.print();window.close();}</script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">💊 Prescription</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700">
              <Printer size={14} /> Print
            </button>
            <button onClick={() => setItems(prev => [...prev, { drug_name: '', dose: '', frequency: 'Twice daily (BD)', duration: '5 Days', route: 'Oral', instructions: '', quantity_prescribed: 1 }])}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <Plus size={14} /> Add Drug
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {items.map((item, index) => (
            <div key={index} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Drug {index + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => setItems(prev => prev.filter((_, i) => i !== index))} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                )}
              </div>

              {/* Drug Search */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="text"
                    value={activeItemIndex === index ? drugSearch : item.drug_name}
                    onChange={e => { setDrugSearch(e.target.value); setActiveItemIndex(index); setItems(prev => prev.map((it, i) => i === index ? { ...it, drug_name: e.target.value } : it)); }}
                    onFocus={() => setActiveItemIndex(index)}
                    placeholder="Search drug name..."
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20" />
                </div>
                {activeItemIndex === index && drugResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {drugResults.map((drug: any) => (
                      <button key={drug.id} onClick={() => selectDrug(drug, index)}
                        className="w-full text-left px-4 py-2.5 hover:bg-green-50 border-b border-slate-50 last:border-0 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{drug.name || drug.productName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${(drug.quantity || drug.availableqty || 0) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {(drug.quantity || drug.availableqty || 0) > 0 ? `${drug.quantity || drug.availableqty} in stock` : 'Out of stock'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {item.available_qty === 0 && (
                  <div className="flex items-center gap-1.5 mt-1 text-amber-600 text-xs">
                    <AlertTriangle size={12} /> Out of stock — prescription still allowed
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Dose</label>
                  <input type="text" value={item.dose} onChange={e => setItems(prev => prev.map((it, i) => i === index ? { ...it, dose: e.target.value } : it))}
                    placeholder="e.g. 500mg" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Frequency</label>
                  <select value={item.frequency} onChange={e => setItems(prev => prev.map((it, i) => i === index ? { ...it, frequency: e.target.value } : it))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Duration</label>
                  <input type="text" value={item.duration} onChange={e => setItems(prev => prev.map((it, i) => i === index ? { ...it, duration: e.target.value } : it))}
                    placeholder="e.g. 5 Days" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Route</label>
                  <select value={item.route} onChange={e => setItems(prev => prev.map((it, i) => i === index ? { ...it, route: e.target.value } : it))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Qty</label>
                  <input type="number" min="1" value={item.quantity_prescribed} onChange={e => setItems(prev => prev.map((it, i) => i === index ? { ...it, quantity_prescribed: parseInt(e.target.value) || 1 } : it))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Instructions</label>
                  <input type="text" value={item.instructions} onChange={e => setItems(prev => prev.map((it, i) => i === index ? { ...it, instructions: e.target.value } : it))}
                    placeholder="e.g. Take with food" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Prescription Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Additional notes for pharmacist..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-green-500/20" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-green-500/25">
          <Save size={16} /> {saveMutation.isLoading ? 'Saving...' : 'Save Prescription'}
        </button>
      </div>
    </div>
  );
}
