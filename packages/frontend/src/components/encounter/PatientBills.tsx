import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Plus, Trash2, CreditCard, Smartphone, Receipt } from 'lucide-react';
import api from '../../api/axios';

interface Props {
  encounterId: number | string;
  patientId: number | string;
  patientName: string;
  patientPhone?: string;
}

interface LineItem {
  description: string;
  category: string;
  amount: number;
}

const CATEGORIES = ['Consultation', 'Procedure', 'Investigation', 'Medication', 'Nursing', 'Admission', 'Other'];

export default function PatientBills({ encounterId, patientId, patientName, patientPhone }: Props) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<LineItem[]>([{ description: 'Consultation Fee', category: 'Consultation', amount: 500 }]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Mpesa'>('Cash');
  const [mpesaPhone, setMpesaPhone] = useState(patientPhone || '');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'completed' | 'failed'>('idle');
  const [invoiceCreated, setInvoiceCreated] = useState<any>(null);

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const addItem = () => setItems(prev => [...prev, { description: '', category: 'Other', amount: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, j) => j !== i));
  const updateItem = (i: number, field: keyof LineItem, value: any) =>
    setItems(prev => prev.map((item, j) => j === i ? { ...item, [field]: value } : item));

  const createBillMutation = useMutation(
    () => api.post(`/encounters/${encounterId}/bills`, { items }),
    {
      onSuccess: (res) => {
        setInvoiceCreated(res.data);
        queryClient.invalidateQueries(['invoices']);
        toast.success(`Invoice ${res.data.invoice_number} created — KES ${total.toLocaleString()}`);
        if (paymentMethod === 'Mpesa') {
          initiateMpesa(res.data.id);
        }
      },
      onError: () => toast.error('Failed to create invoice'),
    }
  );

  const initiateMpesa = async (invoiceId: number) => {
    setPaymentStatus('pending');
    try {
      await api.post('/payments/mpesa/stk', {
        phone: mpesaPhone,
        amount: total,
        invoice_id: invoiceId,
        account_reference: `INV-${invoiceId}`,
      });
      toast.info('M-Pesa prompt sent to ' + mpesaPhone + '. Waiting for payment...');
      // Poll for status
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const res = await api.get(`/invoices/${invoiceId}`);
          if (res.data?.status === 'paid') {
            setPaymentStatus('completed');
            clearInterval(poll);
            toast.success('Payment received via M-Pesa!');
          }
        } catch { /* ignore */ }
        if (attempts >= 12) { // 60 seconds
          clearInterval(poll);
          setPaymentStatus('failed');
          toast.warning('Payment timeout. Please check M-Pesa manually.');
        }
      }, 5000);
    } catch {
      setPaymentStatus('failed');
      toast.error('Failed to initiate M-Pesa payment');
    }
  };

  const handleCashPayment = async () => {
    if (!invoiceCreated) { toast.error('Create invoice first'); return; }
    try {
      await api.post('/payments', {
        invoice_id: invoiceCreated.id,
        amount: total,
        method: 'Cash',
      });
      setPaymentStatus('completed');
      toast.success('Cash payment recorded');
    } catch {
      toast.error('Failed to record payment');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Receipt size={16} className="text-amber-600" /> Patient Bill
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Patient: <strong>{patientName}</strong></p>
          </div>
          <button onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
            <Plus size={14} /> Add Item
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Line Items */}
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <input type="text" value={item.description}
                    onChange={e => updateItem(i, 'description', e.target.value)}
                    placeholder="Description *"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20" />
                </div>
                <div className="col-span-3">
                  <select value={item.category} onChange={e => updateItem(i, 'category', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">KES</span>
                    <input type="number" value={item.amount} min="0"
                      onChange={e => updateItem(i, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20" />
                  </div>
                </div>
                <div className="col-span-1 flex justify-center">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
            <span className="font-semibold text-slate-700">Total Amount</span>
            <span className="text-2xl font-bold text-amber-700">KES {total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
          </div>

          {/* Payment Method */}
          {!invoiceCreated && (
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <p className="text-sm font-medium text-slate-700">Payment Method</p>
              <div className="flex gap-3">
                <button onClick={() => setPaymentMethod('Cash')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${paymentMethod === 'Cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <CreditCard size={18} /> Cash
                </button>
                <button onClick={() => setPaymentMethod('Mpesa')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${paymentMethod === 'Mpesa' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <Smartphone size={18} /> M-Pesa
                </button>
              </div>
              {paymentMethod === 'Mpesa' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">M-Pesa Phone Number</label>
                  <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500/20" />
                </div>
              )}
            </div>
          )}

          {/* Payment Status */}
          {paymentStatus !== 'idle' && (
            <div className={`p-3 rounded-xl text-sm font-medium ${
              paymentStatus === 'pending' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
              paymentStatus === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' :
              'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {paymentStatus === 'pending' && '⏳ Waiting for M-Pesa payment...'}
              {paymentStatus === 'completed' && '✅ Payment received successfully!'}
              {paymentStatus === 'failed' && '❌ Payment failed or timed out. Please verify manually.'}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        {invoiceCreated && paymentMethod === 'Cash' && paymentStatus === 'idle' && (
          <button onClick={handleCashPayment}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/25">
            <CreditCard size={16} /> Record Cash Payment
          </button>
        )}
        {!invoiceCreated && (
          <button onClick={() => createBillMutation.mutate()}
            disabled={createBillMutation.isLoading || items.every(i => !i.description.trim())}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-medium hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/25">
            <Receipt size={16} /> {createBillMutation.isLoading ? 'Creating...' : 'Create Invoice'}
          </button>
        )}
      </div>
    </div>
  );
}
