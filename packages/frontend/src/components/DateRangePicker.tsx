import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

interface DateRange { from: string; to: string; }
interface Props { onChange: (range: DateRange) => void; value?: DateRange; }

const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
const startOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };
const startOfWeek = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; };

const PRESETS = [
  { label: 'Today', from: today(), to: today() },
  { label: 'Yesterday', from: daysAgo(1), to: daysAgo(1) },
  { label: 'This Week', from: startOfWeek(), to: today() },
  { label: 'This Month', from: startOfMonth(), to: today() },
  { label: 'Last 30 Days', from: daysAgo(30), to: today() },
  { label: 'Last 90 Days', from: daysAgo(90), to: today() },
];

export default function DateRangePicker({ onChange, value }: Props) {
  const [activePreset, setActivePreset] = useState('This Month');
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(startOfMonth());
  const [customTo, setCustomTo] = useState(today());

  const selectPreset = (preset: typeof PRESETS[0]) => {
    setActivePreset(preset.label);
    setShowCustom(false);
    onChange({ from: preset.from, to: preset.to });
  };

  const applyCustom = () => {
    setActivePreset('Custom');
    onChange({ from: customFrom, to: customTo });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(preset => (
          <button key={preset.label} onClick={() => selectPreset(preset)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activePreset === preset.label
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {preset.label}
          </button>
        ))}
        <button onClick={() => setShowCustom(!showCustom)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            showCustom || activePreset === 'Custom'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}>
          <Calendar size={14} /> Custom Range
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">From</label>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <span className="text-slate-400">→</span>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">To</label>
            <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <button onClick={applyCustom}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
