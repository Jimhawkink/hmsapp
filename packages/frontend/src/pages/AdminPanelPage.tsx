import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Users, Shield, Clock, Settings, Plus, X, Save, Edit2, UserX } from 'lucide-react';
import api from '../api/axios';

type Tab = 'users' | 'roles' | 'audit' | 'settings';

const ROLES = ['admin', 'doctor', 'nurse', 'pharmacist', 'cashier', 'lab_technician', 'receptionist'];

export default function AdminPanelPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'doctor', password: '', phone: '' });
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [auditFilters, setAuditFilters] = useState({ from: '', to: '', resource: '' });

  const { data: users, isLoading: usersLoading } = useQuery(['admin-users'], () => api.get('/admin/users').then(r => r.data));
  const { data: rolesData } = useQuery(['admin-roles'], () => api.get('/admin/roles').then(r => r.data), { enabled: activeTab === 'roles' });
  const { data: auditLog } = useQuery(
    ['audit-log', auditFilters],
    () => api.get(`/admin/audit-log?from=${auditFilters.from}&to=${auditFilters.to}&resource=${auditFilters.resource}`).then(r => r.data),
    { enabled: activeTab === 'audit' }
  );
  const { data: settings } = useQuery(
    ['system-settings'],
    () => api.get('/admin/settings').then(r => r.data),
    {
      enabled: activeTab === 'settings',
      onSuccess: (data) => setSettingsForm(data || {}),
    }
  );

  const createUserMutation = useMutation(
    () => api.post('/admin/users', userForm),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        toast.success('User created successfully');
        setShowUserModal(false);
        setUserForm({ name: '', email: '', role: 'doctor', password: '', phone: '' });
      },
      onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create user'),
    }
  );

  const updateUserMutation = useMutation(
    () => api.put(`/admin/users/${editingUser?.id}`, userForm),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        toast.success('User updated');
        setShowUserModal(false);
        setEditingUser(null);
      },
      onError: () => toast.error('Failed to update user'),
    }
  );

  const deactivateMutation = useMutation(
    (id: number) => api.patch(`/admin/users/${id}/deactivate`),
    {
      onSuccess: () => { queryClient.invalidateQueries(['admin-users']); toast.success('User deactivated'); },
      onError: () => toast.error('Failed to deactivate user'),
    }
  );

  const saveSettingsMutation = useMutation(
    () => api.put('/admin/settings', settingsForm),
    {
      onSuccess: () => { queryClient.invalidateQueries(['system-settings']); toast.success('Settings saved'); },
      onError: () => toast.error('Failed to save settings'),
    }
  );

  const openEdit = (user: any) => {
    setEditingUser(user);
    setUserForm({ name: user.name, email: user.email, role: user.role, password: '', phone: '' });
    setShowUserModal(true);
  };

  const TABS = [
    { key: 'users' as Tab, label: 'Users', icon: <Users size={15} /> },
    { key: 'roles' as Tab, label: 'Roles & Permissions', icon: <Shield size={15} /> },
    { key: 'audit' as Tab, label: 'Audit Log', icon: <Clock size={15} /> },
    { key: 'settings' as Tab, label: 'System Settings', icon: <Settings size={15} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">⚙️</div>
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-white/70 text-sm">User management, roles, audit log, and system settings</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.key ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">System Users</h3>
            <button onClick={() => { setEditingUser(null); setUserForm({ name: '', email: '', role: 'doctor', password: '', phone: '' }); setShowUserModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700">
              <Plus size={14} /> Add User
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Email</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Role</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Created</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {usersLoading ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">Loading users...</td></tr>
                ) : (users || []).map((user: any) => (
                  <tr key={user.id} className={`hover:bg-slate-50 ${user.role === 'inactive' ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3 font-medium text-slate-800">{user.name}</td>
                    <td className="px-5 py-3 text-slate-600">{user.email}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium capitalize">{user.role}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{new Date(user.created_at).toLocaleDateString('en-KE')}</td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                        {user.role !== 'inactive' && (
                          <button onClick={() => { if (window.confirm(`Deactivate ${user.name}?`)) deactivateMutation.mutate(user.id); }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><UserX size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          {rolesData ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Configure permissions for each role. Changes take effect immediately.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Permission</th>
                      {(rolesData.roles || []).map((role: any) => (
                        <th key={role.id} className="text-center px-3 py-3 font-medium text-slate-600 capitalize">{role.role_name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(rolesData.permissions || []).map((perm: any) => (
                      <tr key={perm.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-700">{perm.permission_name}</p>
                          <p className="text-slate-400">{perm.category}</p>
                        </td>
                        {(rolesData.roles || []).map((role: any) => {
                          const rp = (rolesData.rolePermissions || []).find((r: any) => r.role_id === role.id && r.permission_id === perm.id);
                          return (
                            <td key={role.id} className="px-3 py-2.5 text-center">
                              <span className={`inline-block w-4 h-4 rounded-full ${rp?.can_view ? 'bg-green-500' : 'bg-slate-200'}`} title={rp?.can_view ? 'Has access' : 'No access'} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">Loading roles and permissions...</div>
          )}
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex gap-4 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
              <input type="date" value={auditFilters.from} onChange={e => setAuditFilters(p => ({ ...p, from: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input type="date" value={auditFilters.to} onChange={e => setAuditFilters(p => ({ ...p, to: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Resource</label>
              <input type="text" value={auditFilters.resource} onChange={e => setAuditFilters(p => ({ ...p, resource: e.target.value }))}
                placeholder="e.g. patients, expenses..."
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Time</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">User</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Action</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Resource</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Resource ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(auditLog || []).length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No audit entries found</td></tr>
                  ) : (auditLog || []).map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-500 text-xs">{new Date(entry.created_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{entry.user_name || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.action_type === 'DELETE' ? 'bg-red-100 text-red-700' : entry.action_type === 'CREATE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {entry.action_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{entry.resource_name}</td>
                      <td className="px-5 py-3 text-slate-500 font-mono text-xs">{entry.resource_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-slate-800">System Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'facility_name', label: 'Facility Name' },
              { key: 'kra_pin', label: 'KRA PIN' },
              { key: 'default_currency', label: 'Default Currency' },
              { key: 'sms_sender_id', label: 'SMS Sender ID' },
              { key: 'mpesa_shortcode', label: 'M-Pesa Shortcode' },
              { key: 'mpesa_till', label: 'M-Pesa Till Number' },
              { key: 'at_username', label: "Africa's Talking Username" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input type={key.includes('key') || key.includes('secret') ? 'password' : 'text'}
                  value={settingsForm[key] || ''}
                  onChange={e => setSettingsForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-500/20" />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 disabled:opacity-50 transition-all">
              <Save size={16} /> {saveSettingsMutation.isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">{editingUser ? 'Edit User' : 'Add User'}</h3>
              <button onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                  <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-500/20">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input type="tel" value={userForm.phone} onChange={e => setUserForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="0712345678"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-500/20" />
                </div>
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Password <span className="text-red-500">*</span></label>
                  <input type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-500/20" />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => editingUser ? updateUserMutation.mutate() : createUserMutation.mutate()}
                  disabled={createUserMutation.isLoading || updateUserMutation.isLoading || !userForm.name || !userForm.email}
                  className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                  <Save size={14} /> {editingUser ? 'Update' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
