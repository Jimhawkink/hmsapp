import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Save } from 'lucide-react';
import api from '../api/axios';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const CATEGORIES = ['Salaries', 'Utilities', 'Supplies', 'Equipment', 'Maintenance', 'Rent', 'Marketing', 'Other'];
const COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899','#64748B'];

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function ExpenseSummaryPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});

  const { data: summary, isLoading } = useQuery(
    ['expense-summary', period],
    () => api.get(`/expenses/summary?period=${period}`).then(r => r.data)
  );

  const setBudgetMutation = useMutation(
    ({ category, amount }: { category: string; amount: number }) =>
      api.post('/budgets', { category, period, budget_amount: amount }),
    {
      onSuccess: () => { queryClient.invalidateQueries(['expense-summary', period]); toast.success('Budget saved'); },
      onError: () => toast.error('Failed to save budget'),
    }
  );

  const handleSaveBudget = (category: string) => {
    const amount = parseFloat(budgetInputs[category] || '0');
    if (isNaN(amount) || amount < 0) { toast.error('Enter a valid amount'); return; }
    setBudgetMutation.mutate({ category, amount });
  };

  const byCategory: any[] = summary?.byCategory || [];
  const monthlyTrend: any[] = summary?.monthlyTrend || [];
  const budgets: any[] = summary?.budgets || [];

  const totalExpenses = byCategory.reduce((sum: number, c: any) => sum + Number(c.total || 0), 0);

  const doughnutData = {
    labels: byCategory.map((c: any) => c.category),
    datasets: [{
      data: byCategory.map((c: any) => Number(c.total || 0)),
      backgroundColor: COLORS,
      borderWidth: 0,
      cutout: '65%',
    }],
  };

  const barData = {
    labels: monthlyTrend.map((m: any) => m.month),
    datasets: [{
      label: 'Total Expenses (KES)',
      data: monthlyTrend.map((m: any) => Number(m.total || 0)),
      backgroundColor: 'rgba(239,68,68,0.7)',
      borderRadius: 6,
      borderSkipped: false as const,
    }],
  };

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' } } } };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">📊</div>
            <div>
              <h1 className="text-2xl font-bold">Expense Summary</h1>
              <p className="text-white/80 text-sm">Budget vs. actual analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-white/80 text-sm">Period:</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="px-3 py-2 bg-white/20 border border-white/30 rounded-xl text-white text-sm focus:ring-2 focus:ring-white/30" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-3 h-3 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.1}s` }} />)}</div>
        </div>
      ) : (
        <>
          {/* Total */}
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-5 text-white shadow-lg">
            <p className="text-rose-100 text-sm">Total Expenses — {period}</p>
            <p className="text-3xl font-extrabold mt-1">KES {totalExpenses.toLocaleString('en-KE')}</p>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Doughnut */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Expenses by Category</h3>
              {byCategory.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="relative w-44 h-44 flex-shrink-0">
                    <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-extrabold text-slate-800">KES</span>
                      <span className="text-xs text-slate-500">{Math.round(totalExpenses / 1000)}K</span>
                    </div>
                  </div>
                  <div className="space-y-2 flex-1">
                    {byCategory.map((c: any, i: number) => {
                      const pct = totalExpenses > 0 ? (Number(c.total) / totalExpenses * 100) : 0;
                      return (
                        <div key={c.category}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              {c.category}
                            </span>
                            <span className="font-bold">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-44 text-slate-400 text-sm">No expense data for this period</div>
              )}
            </div>

            {/* Monthly Trend Bar */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Monthly Trend (Last 12 Months)</h3>
              <div className="h-52">
                {monthlyTrend.length > 0
                  ? <Bar data={barData} options={chartOpts} />
                  : <div className="flex items-center justify-center h-full text-slate-400 text-sm">No trend data available</div>
                }
              </div>
            </div>
          </div>

          {/* Budget vs Actual Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">💰 Budget vs. Actual — {period}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Set budgets per category and track spending</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Category</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-600">Budget (KES)</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-600">Actual (KES)</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-600">Variance</th>
                    <th className="text-center px-5 py-3 font-medium text-slate-600">Set Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {CATEGORIES.map(cat => {
                    const budgetRow = budgets.find((b: any) => b.category === cat);
                    const actualRow = byCategory.find((c: any) => c.category === cat);
                    const budget = Number(budgetRow?.budget_amount || 0);
                    const actual = Number(actualRow?.total || 0);
                    const variance = budget - actual;
                    const isOver = budget > 0 && actual > budget;

                    return (
                      <tr key={cat} className={`hover:bg-slate-50 ${isOver ? 'bg-red-50' : ''}`}>
                        <td className="px-5 py-3 font-medium text-slate-800">{cat}</td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {budget > 0 ? `KES ${budget.toLocaleString('en-KE')}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-rose-700">
                          {actual > 0 ? `KES ${actual.toLocaleString('en-KE')}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={`px-5 py-3 text-right font-bold ${isOver ? 'text-red-600' : variance > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                          {budget > 0 ? (isOver ? `▲ KES ${Math.abs(variance).toLocaleString('en-KE')} over` : `▼ KES ${variance.toLocaleString('en-KE')} left`) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <input type="number" min="0"
                              value={budgetInputs[cat] ?? (budget > 0 ? String(budget) : '')}
                              onChange={e => setBudgetInputs(p => ({ ...p, [cat]: e.target.value }))}
                              placeholder="0"
                              className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-rose-500/20" />
                            <button onClick={() => handleSaveBudget(cat)}
                              className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">
                              <Save size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
