import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Plus, X, Save, Bed } from 'lucide-react';
import api from '../api/axios';

const WARD_TYPES = ['Medical', 'Surgical', 'Maternity', 'Pediatric', 'ICU', 'General'];

const BED_STATUS_COLORS: Record<string, string> = {
  Vacant: 'bg-green-100 border-green-300 text-green-700',
  Occupied: 'bg-red-100 border-red-300 text-red-700',
  Reserved: 'bg-amber-100 border-amber-300 text-amber-700',
  Maintenance: 'bg-slate-100 border-slate-300 text-slate-500',
};

export default function WardManagementPage() {
  const queryClient = useQueryClient();
  const [selectedWard, setSelectedWard] = useState<any>(null);
  const [showCreateWard, setShowCreateWard] = useState(false);
  const [showAddBed, setShowAddBed] = useState(false);
  const [wardForm, setWardForm] = useState({ ward_name: '', ward_type: 'Medical', total_beds: '10' });
  const [bedNumber, setBedNumber] = useState('');

  const { data: wards, isLoading } = useQuery(['wards'], () => api.get('/wards').then(r => r.data));
  const { data: beds } = useQuery(
    ['ward-beds', selectedWard?.id],
    () => api.get(`/wards/${selectedWard?.id}/beds`).then(r => r.data),
    { enabled: !!selectedWard?.id }
  );

  const createWardMutation = useMutation(
    () => api.post('/wards', { ...wardForm, total_beds: parseInt(wardForm.total_beds) || 0 }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['wards']);
        toast.success('Ward created successfully');
        setShowCreateWard(false);
        setWardForm({ ward_name: '', ward_type: 'Medical', total_beds: '10' });
      },
      onError: () => toast.error('Failed to create ward'),
    }
  );

  const addBedMutation = useMutation(
    () => api.post(`/wards/${selectedWard?.id}/beds`, { bed_number: bedNumber }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ward-beds', selectedWard?.id]);
        toast.success('Bed added');
        setShowAddBed(false);
        setBedNumber('');
      },
      onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add bed'),
    }
  );

  const totalBeds = (wards || []).reduce((s: number, w: any) => s + Number(w.total_beds || 0), 0);
  const occupiedBeds = (wards || []).reduce((s: number, w: any) => s + Number(w.occupied_beds || 0), 0);
  const vacantBeds = (wards || []).reduce((s: number, w: any) => s + Number(w.vacant_beds || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🏥</div>
            <div>
              <h1 className="text-2xl font-bold">Ward Management</h1>
              <p className="text-white/80 text-sm">Inpatient bed and ward administration</p>
            </div>
          </div>
          <button onClick={() => setShowCreateWard(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition-colors shadow-lg">
            <Plus size={16} /> Create Ward
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Beds', value: totalBeds, color: 'from-blue-500 to-indigo-600', emoji: '🛏️' },
          { label: 'Occupied', value: occupiedBeds, color: 'from-red-500 to-rose-600', emoji: '🔴' },
          { label: 'Vacant', value: vacantBeds, color: 'from-green-500 to-emerald-600', emoji: '🟢' },
        ].map(stat => (
          <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-xl p-5 text-white shadow-lg`}>
            <p className="text-white/80 text-sm">{stat.emoji} {stat.label}</p>
            <p className="text-3xl font-extrabold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ward List */}
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Wards</h2>
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading wards...</div>
          ) : (wards || []).length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              No wards created yet
            </div>
          ) : (wards || []).map((ward: any) => (
            <button key={ward.id} onClick={() => setSelectedWard(ward)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedWard?.id === ward.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{ward.ward_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{ward.ward_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-700">{ward.occupied_beds}/{ward.total_beds}</p>
                  <p className="text-xs text-slate-400">occupied</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${ward.total_beds > 0 ? (ward.occupied_beds / ward.total_beds * 100) : 0}%` }} />
              </div>
            </button>
          ))}
        </div>

        {/* Bed Grid */}
        <div className="lg:col-span-2">
          {selectedWard ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{selectedWard.ward_name} — Beds</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedWard.ward_type}</p>
                </div>
                <button onClick={() => setShowAddBed(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  <Plus size={14} /> Add Bed
                </button>
              </div>

              {/* Legend */}
              <div className="px-5 py-3 border-b border-slate-100 flex gap-4 text-xs">
                {Object.entries(BED_STATUS_COLORS).map(([status, cls]) => (
                  <span key={status} className={`px-2 py-1 rounded-lg border font-medium ${cls}`}>{status}</span>
                ))}
              </div>

              <div className="p-5 grid grid-cols-4 md:grid-cols-6 gap-3">
                {(beds || []).map((bed: any) => (
                  <div key={bed.id}
                    className={`border-2 rounded-xl p-3 text-center transition-all ${BED_STATUS_COLORS[bed.status] || BED_STATUS_COLORS.Vacant}`}>
                    <Bed size={20} className="mx-auto mb-1" />
                    <p className="text-xs font-bold">{bed.bed_number}</p>
                    <p className="text-[10px] mt-0.5">{bed.status}</p>
                    {bed.patient_name && (
                      <p className="text-[10px] mt-1 font-medium truncate" title={bed.patient_name}>{bed.patient_name}</p>
                    )}
                  </div>
                ))}
                {(!beds || beds.length === 0) && (
                  <div className="col-span-6 py-10 text-center text-slate-400 text-sm">No beds in this ward</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
              <div className="text-center">
                <Bed size={40} className="mx-auto mb-3 opacity-30" />
                <p>Select a ward to view beds</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Ward Modal */}
      {showCreateWard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-blue-50">
              <h3 className="font-bold text-slate-800">Create New Ward</h3>
              <button onClick={() => setShowCreateWard(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ward Name <span className="text-red-500">*</span></label>
                <input type="text" value={wardForm.ward_name} onChange={e => setWardForm(p => ({ ...p, ward_name: e.target.value }))}
                  placeholder="e.g. Male Medical Ward"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ward Type</label>
                <select value={wardForm.ward_type} onChange={e => setWardForm(p => ({ ...p, ward_type: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20">
                  {WARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Number of Beds</label>
                <input type="number" min="0" max="100" value={wardForm.total_beds}
                  onChange={e => setWardForm(p => ({ ...p, total_beds: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20" />
                <p className="text-xs text-slate-400 mt-1">Beds will be auto-created with sequential numbers</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreateWard(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => createWardMutation.mutate()} disabled={createWardMutation.isLoading || !wardForm.ward_name}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  <Save size={14} /> {createWardMutation.isLoading ? 'Creating...' : 'Create Ward'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Bed Modal */}
      {showAddBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-blue-50">
              <h3 className="font-bold text-slate-800">Add Bed to {selectedWard?.ward_name}</h3>
              <button onClick={() => setShowAddBed(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bed Number <span className="text-red-500">*</span></label>
                <input type="text" value={bedNumber} onChange={e => setBedNumber(e.target.value)}
                  placeholder="e.g. MED-11"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowAddBed(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => addBedMutation.mutate()} disabled={addBedMutation.isLoading || !bedNumber}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  <Plus size={14} /> Add Bed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
