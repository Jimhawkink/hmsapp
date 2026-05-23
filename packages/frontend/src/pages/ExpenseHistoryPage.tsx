import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import api from '../api/axios';
import DateRangePicker from '../components/DateRangePicker';
import ExportButtons from '../components/ExportButtons';

const today = new Date().toISOString().split('T')[0];
const startOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

const CATEGORIES = ['Salaries', 'Utilities', 'Supplies', 'Equipment', 'Maintenance', 'Rent', 'Marketing', 'Other'];
const PAYMENT_MODES = ['Cash', 'M-Pesa', 'Bank Transfer', 'Cheque'];

interface Expense {
  expense_id: number;
  expense_name: string;
  category: string;
  amount: number;
  expense_date: string;
  payment_mode: string;
  reference_no?: string;
  description?: string;
}

const emptyForm = { expense_name: '', category: 'Other', amount: '', expense_date: today, payment_mode: 'Cash', reference_no: '', description: '' };

export default function ExpenseHistoryPage() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState({ from: startOfMonth(), to: today });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: expenses, isLoading } = useQuery(
    ['expenses', dateRange, categoryFilter],
    () => api.get(`/expenses?from=${dateRange.from}&to=${dateRange.to}${categoryFilter !== 'all' ? `&category=${categoryFilter}` : ''}`).then(r => r.data)
  );

  const saveMutation = useMutation(
    () => editingExpense
      ? api.put(`/expenses/${editingExpense.expense_id}`, form)
      : api.post('/expenses', form),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['expenses']);
        toast.success(editingExpense ? 'Expense updated' : 'Expense added');
        setShowModal(false);
        setEditingExpense(null);
        setForm(emptyForm);
      },
      onError: () => toast.error('Failed to save expense'),
    }
  );

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/expenses/${id}`),
    {
      onSuccess: () => { queryClient.invalidateQueries(['expenses']); toast.success('Expense deleted'); },
      onError: () => toast.error('Failed to delete expense'),
    }
  );

  const openAdd = () => { setEditingExpense(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setForm({ expense_name: exp.expense_name, category: exp.category, amount: exp.amount, expense_date: exp.expense_date?.split('T')[0] || today, payment_mode: exp.payment_mode, reference_no: exp.reference_no || '', description: exp.description || '' });
    setShowModal(true);
  };

  const handleDelete = (exp: Expense) => {
    if (window.confirm(`Delete expense "${exp.expense_name}"?`)) deleteMutation.mutate(exp.expense_id);
  };

  const totalAmount = (expenses || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">💸</div>
            <div>
              <h1 className="text-2xl font-bold">Expense History</h1>
              <p className="text-white/80 text-sm">Track and manage operational expenses</p>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-rose-700 rounded-xl font-semibold hover:bg-rose-50 transition-colors shadow-lg">
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">Category:</label>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="ml-auto">
            <ExportButtons data={expenses || []} filename="expenses" title="Expense History"
              dateRange={dateRange}
              columns={[{ key: 'expense_date', label: 'Date' }, { key: 'expense_name', label: 'Description' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount (KES)' }, { key: 'payment_mode', label: 'Payment Mode' }]} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total Expenses</p>
          <p className="text-2xl font-bold text-rose-700 mt-1">KES {totalAmount.toLocaleString('en-KE')}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Transactions</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{(expenses || []).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500">Average per Transaction</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            KES {(expenses || []).length > 0 ? Math.round(totalAmount / (expenses || []).length).toLocaleString('en-KE') : 0}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Description</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Category</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Amount (KES)</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Payment</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Loading...</td></tr>
              ) : (expenses || []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No expenses found for selected period</td></tr>
              ) : (expenses || []).map((exp: any) => (
                <tr key={exp.expense_id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-600">{new Date(exp.expense_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-5 py-3 font-medium text-slate-800">{exp.expense_name}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs font-medium">{exp.category}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-rose-700">KES {Number(exp.amount).toLocaleString('en-KE')}</td>
                  <td className="px-5 py-3 text-slate-600">{exp.payment_mode}</td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(exp)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(exp)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-rose-50">
              <h3 className="font-bold text-slate-800">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description <span className="text-red-500">*</span></label>
                  <input type="text" value={form.expense_name} onChange={e => setForm((p: any) => ({ ...p, expense_name: e.target.value }))}
                    placeholder="e.g. Electricity bill, Staff salary..."
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm((p: any) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount (KES) <span className="text-red-500">*</span></label>
                  <input type="number" value={form.amount} min="0" onChange={e => setForm((p: any) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm((p: any) => ({ ...p, expense_date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
                  <select value={form.payment_mode} onChange={e => setForm((p: any) => ({ ...p, payment_mode: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20">
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Reference No.</label>
                  <input type="text" value={form.reference_no} onChange={e => setForm((p: any) => ({ ...p, reference_no: e.target.value }))}
                    placeholder="Receipt / M-Pesa code..."
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea value={form.description} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} rows={2}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-rose-500/20" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading || !form.expense_name || !form.amount}
                  className="flex items-center gap-2 px-5 py-2 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 disabled:opacity-50">
                  <Save size={14} /> {saveMutation.isLoading ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
