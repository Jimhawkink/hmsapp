import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { FlaskConical, CheckCircle, X, Printer } from 'lucide-react';
import api from '../api/axios';

const STATUS_CONFIG: Record<string, { label: string; color: string; next?: string }> = {
  requested: { label: 'Requested', color: 'bg-yellow-100 text-yellow-700', next: 'collect' },
  not_collected: { label: 'Not Collected', color: 'bg-red-100 text-red-700', next: 'collect' },
  collected: { label: 'Collected', color: 'bg-blue-100 text-blue-700', next: 'results' },
  results_posted: { label: 'Results Posted', color: 'bg-green-100 text-green-700', next: 'validate' },
};

const FLAG_COLORS: Record<string, string> = {
  H: 'text-red-600 font-bold',
  L: 'text-blue-600 font-bold',
  Critical: 'text-red-700 font-extrabold bg-red-100 px-1 rounded',
};

export default function LabWorklist() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [resultInputs, setResultInputs] = useState<Record<string, string>>({});
  const [showResultModal, setShowResultModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: worklist, isLoading } = useQuery(
    ['lab-worklist'],
    () => api.get('/lab/worklist').then(r => r.data),
    { refetchInterval: 30000 }
  );

  const { data: requestDetail } = useQuery(
    ['lab-request-detail', selectedRequest?.id],
    () => api.get(`/lab/requests/${selectedRequest?.id}/parameters`).then(r => r.data),
    { enabled: !!selectedRequest?.id }
  );

  const collectMutation = useMutation(
    (id: number) => api.patch(`/lab/requests/${id}/collect`),
    {
      onSuccess: () => { queryClient.invalidateQueries(['lab-worklist']); toast.success('Sample marked as collected'); },
      onError: () => toast.error('Failed to update status'),
    }
  );

  const saveResultsMutation = useMutation(
    ({ id, results }: { id: number; results: any[] }) =>
      api.post(`/lab/requests/${id}/results`, { results, entered_by: 1 }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['lab-worklist']);
        toast.success('Results saved successfully');
        setShowResultModal(false);
        setSelectedRequest(null);
        setResultInputs({});
      },
      onError: () => toast.error('Failed to save results'),
    }
  );

  const validateMutation = useMutation(
    (id: number) => api.patch(`/lab/requests/${id}/validate`, { validator_id: 1 }),
    {
      onSuccess: () => { queryClient.invalidateQueries(['lab-worklist']); toast.success('Results validated'); },
      onError: () => toast.error('Failed to validate'),
    }
  );

  const handleSaveResults = () => {
    if (!requestDetail) return;
    const results: any[] = [];

    if (requestDetail.parameters && requestDetail.parameters.length > 0) {
      requestDetail.parameters.forEach((param: any) => {
        const value = resultInputs[param.parameter];
        if (value) {
          results.push({ parameter: param.parameter, value, unit: param.unit || null, reference_range: param.range || null });
        }
      });
    } else {
      const value = resultInputs['result'];
      if (value) results.push({ parameter: requestDetail.test_name, value, unit: null, reference_range: null });
    }

    if (results.length === 0) { toast.error('Enter at least one result value'); return; }
    saveResultsMutation.mutate({ id: selectedRequest.id, results });
  };

  const handlePrintReport = async (request: any) => {
    try {
      const res = await api.get(`/lab/requests/${request.id}/report`);
      const report = res.data;
      const win = window.open('', '_blank', 'width=700,height=800');
      if (!win) return;

      const resultsHtml = (report.results || []).map((r: any) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.parameter || '—'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;${r.flag ? 'color:red;font-weight:bold;' : ''}">${r.value} ${r.flag ? `(${r.flag})` : ''}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.unit || '—'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.reference_range || '—'}</td>
        </tr>`).join('');

      win.document.write(`<!DOCTYPE html><html><head><title>Lab Report</title>
        <style>body{font-family:Arial,sans-serif;padding:20px;max-width:650px;margin:0 auto;}
        h2{text-align:center;font-size:16px;} table{width:100%;border-collapse:collapse;}
        th{background:#f5f5f5;padding:8px 10px;text-align:left;font-size:12px;border-bottom:2px solid #ddd;}
        .info{display:flex;gap:20px;margin-bottom:12px;font-size:13px;}
        .label{font-weight:bold;min-width:120px;} @media print{body{padding:0;}}</style></head><body>
        <h2>LABORATORY REPORT</h2>
        <div class="info"><span class="label">Patient:</span><span>${report.patient_name}</span></div>
        <div class="info"><span class="label">Test:</span><span>${report.test_name}</span></div>
        <div class="info"><span class="label">Department:</span><span>${report.department || '—'}</span></div>
        <div class="info"><span class="label">Date Requested:</span><span>${new Date(report.date_requested).toLocaleString('en-KE')}</span></div>
        <div class="info"><span class="label">Encounter:</span><span>${report.encounter_number}</span></div>
        <div class="info"><span class="label">Requested By:</span><span>${report.requested_by_name}</span></div>
        <table><thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference Range</th></tr></thead>
        <tbody>${resultsHtml}</tbody></table>
        <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:12px;">
          <div>Lab Technician: ________________________</div>
          <div>Date: ________________________</div>
        </div>
        <script>window.onload=function(){window.print();}</script></body></html>`);
      win.document.close();
    } catch { toast.error('Failed to load report'); }
  };

  const filtered = (worklist || []).filter((r: any) => filterStatus === 'all' || r.status === filterStatus);

  const pendingCount = (worklist || []).filter((r: any) => r.status !== 'results_posted').length;
  const overdueCount = (worklist || []).filter((r: any) => Number(r.hours_elapsed) > 2 && r.status !== 'results_posted').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-teal-600 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🔬</div>
          <div>
            <h1 className="text-2xl font-bold">Laboratory Worklist</h1>
            <p className="text-white/80 text-sm">{pendingCount} pending · {overdueCount > 0 ? `⚠️ ${overdueCount} overdue (>2hrs)` : 'All on time'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = (worklist || []).filter((r: any) => r.status === key).length;
          return (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-500">{cfg.label}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[{ key: 'all', label: 'All' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterStatus === f.key ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Worklist Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Patient</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Test</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Department</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Requested By</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Time</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Loading worklist...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No investigation requests</td></tr>
              ) : filtered.map((request: any) => {
                const hours = Number(request.hours_elapsed || 0);
                const isOverdue = hours > 2 && request.status !== 'results_posted';
                return (
                  <tr key={request.id} className={`hover:bg-cyan-50/30 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{request.patient_name}</p>
                      <p className="text-xs text-slate-500">{request.encounter_number}</p>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700">{request.test_name}</td>
                    <td className="px-5 py-3 text-slate-600">{request.department || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{request.requested_by_name}</td>
                    <td className="px-5 py-3">
                      <p className="text-xs text-slate-500">{new Date(request.date_requested).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</p>
                      {isOverdue && <p className="text-xs text-red-600 font-medium">⚠️ {Math.round(hours)}h elapsed</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[request.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_CONFIG[request.status]?.label || request.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {(request.status === 'requested' || request.status === 'not_collected') && (
                          <button onClick={() => collectMutation.mutate(request.id)}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                            Collect
                          </button>
                        )}
                        {request.status === 'collected' && (
                          <button onClick={() => { setSelectedRequest(request); setShowResultModal(true); setResultInputs({}); }}
                            className="px-2 py-1 bg-teal-600 text-white rounded text-xs hover:bg-teal-700">
                            Enter Results
                          </button>
                        )}
                        {request.status === 'results_posted' && (
                          <>
                            <button onClick={() => validateMutation.mutate(request.id)}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                              Validate
                            </button>
                            <button onClick={() => handlePrintReport(request)}
                              className="p-1 text-slate-500 hover:bg-slate-100 rounded">
                              <Printer size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Entry Modal */}
      {showResultModal && requestDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-teal-50">
              <div>
                <h3 className="font-bold text-slate-800">Enter Results — {requestDetail.test_name}</h3>
                <p className="text-sm text-slate-600">Patient: {selectedRequest?.patient_name}</p>
              </div>
              <button onClick={() => { setShowResultModal(false); setSelectedRequest(null); }} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {requestDetail.parameters && requestDetail.parameters.length > 0 ? (
                requestDetail.parameters.map((param: any) => (
                  <div key={param.parameter} className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-600 mb-1">{param.parameter}</label>
                      <input type="text" value={resultInputs[param.parameter] || ''}
                        onChange={e => setResultInputs(prev => ({ ...prev, [param.parameter]: e.target.value }))}
                        placeholder={`Value (${param.unit || 'unit'})`}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20" />
                    </div>
                    <div className="text-xs text-slate-500 mt-4">
                      <p>Unit: {param.unit || '—'}</p>
                      <p>Ref: {param.range || '—'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Result</label>
                  <input type="text" value={resultInputs['result'] || ''}
                    onChange={e => setResultInputs(prev => ({ ...prev, result: e.target.value }))}
                    placeholder="Enter result..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20" />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { setShowResultModal(false); setSelectedRequest(null); }} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveResults} disabled={saveResultsMutation.isLoading}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                <CheckCircle size={14} /> {saveResultsMutation.isLoading ? 'Saving...' : 'Save Results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
