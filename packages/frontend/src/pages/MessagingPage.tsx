import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Send, MessageSquare, Users, BookOpen, Clock, Search } from 'lucide-react';
import api from '../api/axios';

type Tab = 'compose' | 'bulk' | 'templates' | 'history';

const STATUS_COLORS: Record<string, string> = {
  Sent: 'bg-blue-100 text-blue-700',
  Delivered: 'bg-green-100 text-green-700',
  Failed: 'bg-red-100 text-red-700',
};

export default function MessagingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('compose');

  // Compose state
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [patientSearch, setPatientSearch] = useState('');

  // Bulk state
  const [bulkMessage, setBulkMessage] = useState('');

  const { data: templates } = useQuery(['sms-templates'], () => api.get('/messaging/templates').then(r => r.data));
  const { data: history, refetch: refetchHistory } = useQuery(['sms-history'], () => api.get('/messaging/history').then(r => r.data), { enabled: activeTab === 'history' });
  const { data: patients } = useQuery(
    ['patients-search', patientSearch],
    () => api.get(`/patients?search=${patientSearch}`).then(r => r.data),
    { enabled: patientSearch.length >= 2 }
  );

  const sendMutation = useMutation(
    () => api.post('/messaging/send', { phone, message, recipient_name: recipientName }),
    {
      onSuccess: () => {
        toast.success('SMS sent successfully');
        setPhone(''); setMessage(''); setRecipientName('');
        queryClient.invalidateQueries(['sms-history']);
      },
      onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send SMS'),
    }
  );

  const bulkMutation = useMutation(
    () => api.post('/messaging/bulk', { message: bulkMessage }),
    {
      onSuccess: (res) => {
        toast.success(`Bulk SMS sent: ${res.data.sent} delivered, ${res.data.failed} failed`);
        setBulkMessage('');
        queryClient.invalidateQueries(['sms-history']);
      },
      onError: () => toast.error('Failed to send bulk SMS'),
    }
  );

  const selectPatient = (patient: any) => {
    setPhone(patient.phone || '');
    setRecipientName(`${patient.firstName || patient.first_name} ${patient.lastName || patient.last_name}`);
    setPatientSearch('');
  };

  const applyTemplate = (template: any) => {
    setMessage(template.body);
    setActiveTab('compose');
    toast.info(`Template "${template.name}" applied`);
  };

  const TABS = [
    { key: 'compose' as Tab, label: 'Compose', icon: <MessageSquare size={15} /> },
    { key: 'bulk' as Tab, label: 'Bulk SMS', icon: <Users size={15} /> },
    { key: 'templates' as Tab, label: 'Templates', icon: <BookOpen size={15} /> },
    { key: 'history' as Tab, label: 'History', icon: <Clock size={15} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">💬</div>
          <div>
            <h1 className="text-2xl font-bold">Messaging</h1>
            <p className="text-white/80 text-sm">Send SMS notifications to patients via Africa's Talking</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === 'history') refetchHistory(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-indigo-50 px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">✉️ Compose SMS</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Patient Search */}
            <div className="relative">
              <label className="block text-xs font-medium text-slate-600 mb-1">Search Patient (optional)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="text" value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              {patientSearch.length >= 2 && Array.isArray(patients) && patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {patients.slice(0, 8).map((p: any) => (
                    <button key={p.id} onClick={() => selectPatient(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 border-b border-slate-50 last:border-0 text-sm">
                      <span className="font-medium text-slate-800">{p.firstName || p.first_name} {p.lastName || p.last_name}</span>
                      <span className="ml-2 text-slate-500">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Name</label>
                <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)}
                  placeholder="Patient name..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number <span className="text-red-500">*</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 0712345678"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-600">Message <span className="text-red-500">*</span></label>
                <span className={`text-xs font-medium ${message.length > 160 ? 'text-orange-600' : 'text-slate-400'}`}>
                  {message.length} chars ({Math.ceil(message.length / 160)} SMS)
                </span>
              </div>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                placeholder="Type your message here..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 resize-none" />
            </div>

            <div className="flex justify-end">
              <button onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isLoading || !phone || !message}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/25">
                <Send size={16} /> {sendMutation.isLoading ? 'Sending...' : 'Send SMS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk SMS Tab */}
      {activeTab === 'bulk' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-purple-50 px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">📢 Bulk SMS</h3>
            <p className="text-xs text-slate-500 mt-0.5">Send to all patients with registered phone numbers</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              ⚠️ This will send SMS to all patients with phone numbers. Use with caution.
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-600">Message <span className="text-red-500">*</span></label>
                <span className={`text-xs font-medium ${bulkMessage.length > 160 ? 'text-orange-600' : 'text-slate-400'}`}>
                  {bulkMessage.length} chars
                </span>
              </div>
              <textarea value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} rows={5}
                placeholder="Type your bulk message here..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 resize-none" />
            </div>
            <div className="flex justify-end">
              <button onClick={() => { if (window.confirm('Send this SMS to all patients?')) bulkMutation.mutate(); }}
                disabled={bulkMutation.isLoading || !bulkMessage}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/25">
                <Users size={16} /> {bulkMutation.isLoading ? 'Sending...' : 'Send Bulk SMS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-3">
          {(templates || []).map((template: any) => (
            <div key={template.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-800">{template.name}</h4>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{template.body}</p>
                </div>
                <button onClick={() => applyTemplate(template)}
                  className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Use Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">📜 SMS History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Recipient</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Phone</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Message</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(history || []).map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{row.patient_name || row.recipient_name || '—'}</td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-xs">{row.recipient_phone}</td>
                    <td className="px-5 py-3 text-slate-600 max-w-xs truncate">{row.message_body}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status] || 'bg-slate-100 text-slate-600'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {new Date(row.created_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {(!history || history.length === 0) && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No messages sent yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
