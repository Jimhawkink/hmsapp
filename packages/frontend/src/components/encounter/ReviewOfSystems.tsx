import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Save } from 'lucide-react';
import api from '../../api/axios';

interface Props { encounterId: number | string; }

const SYSTEMS = [
  { key: 'general', label: 'General', icon: '🧍' },
  { key: 'heent', label: 'HEENT', icon: '👁️' },
  { key: 'cardiovascular', label: 'Cardiovascular', icon: '❤️' },
  { key: 'respiratory', label: 'Respiratory', icon: '🫁' },
  { key: 'gastrointestinal', label: 'Gastrointestinal', icon: '🫃' },
  { key: 'genitourinary', label: 'Genitourinary', icon: '🔵' },
  { key: 'musculoskeletal', label: 'Musculoskeletal', icon: '🦴' },
  { key: 'neurological', label: 'Neurological', icon: '🧠' },
  { key: 'skin', label: 'Skin', icon: '🩹' },
  { key: 'psychiatric', label: 'Psychiatric', icon: '💭' },
];

type SystemStatus = 'normal' | 'abnormal' | 'not_assessed';

interface SystemData {
  status: SystemStatus;
  findings: string;
}

type ROSData = Record<string, SystemData>;

const defaultROS = (): ROSData =>
  Object.fromEntries(SYSTEMS.map(s => [s.key, { status: 'not_assessed' as SystemStatus, findings: '' }]));

export default function ReviewOfSystems({ encounterId }: Props) {
  const queryClient = useQueryClient();
  const [rosData, setRosData] = useState<ROSData>(defaultROS());

  const { data: existing } = useQuery(
    ['ros', encounterId],
    () => api.get(`/encounters/${encounterId}/ros`).then(r => r.data),
    { enabled: !!encounterId }
  );

  useEffect(() => {
    if (existing?.ros_data) {
      const parsed = typeof existing.ros_data === 'string' ? JSON.parse(existing.ros_data) : existing.ros_data;
      setRosData({ ...defaultROS(), ...parsed });
    }
  }, [existing]);

  const saveMutation = useMutation(
    () => api.post(`/encounters/${encounterId}/ros`, { ros_data: rosData }),
    {
      onSuccess: () => { queryClient.invalidateQueries(['ros', encounterId]); toast.success('Review of Systems saved'); },
      onError: () => toast.error('Failed to save ROS'),
    }
  );

  const updateSystem = (key: string, field: 'status' | 'findings', value: string) => {
    setRosData(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const abnormalCount = Object.values(rosData).filter(s => s.status === 'abnormal').length;
  const normalCount = Object.values(rosData).filter(s => s.status === 'normal').length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex gap-3 text-sm">
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">✓ {normalCount} Normal</span>
        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">⚠ {abnormalCount} Abnormal</span>
        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">— {SYSTEMS.length - normalCount - abnormalCount} Not Assessed</span>
      </div>

      <div className="space-y-2">
        {SYSTEMS.map(system => {
          const data = rosData[system.key];
          const isAbnormal = data.status === 'abnormal';
          return (
            <div key={system.key}
              className={`border rounded-xl p-3 transition-all ${isAbnormal ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-3">
                <span className="text-lg w-7 text-center">{system.icon}</span>
                <span className="font-medium text-slate-800 w-36 text-sm">{system.label}</span>
                <div className="flex gap-2 flex-1">
                  {(['normal', 'abnormal', 'not_assessed'] as SystemStatus[]).map(status => (
                    <button key={status} onClick={() => updateSystem(system.key, 'status', status)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        data.status === status
                          ? status === 'normal' ? 'bg-green-600 text-white'
                            : status === 'abnormal' ? 'bg-red-600 text-white'
                            : 'bg-slate-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>
                      {status === 'not_assessed' ? 'N/A' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {isAbnormal && (
                <div className="mt-2 ml-10">
                  <input type="text" value={data.findings}
                    onChange={e => updateSystem(system.key, 'findings', e.target.value)}
                    placeholder={`Describe ${system.label.toLowerCase()} findings...`}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 bg-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25">
          <Save size={16} />
          {saveMutation.isLoading ? 'Saving...' : 'Save Review of Systems'}
        </button>
      </div>
    </div>
  );
}
