import React, { useState, useEffect } from 'react';
import { Settings, Shield, Key, Users, Check, Plus, Trash2, Power, UserCheck, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { User, Role } from '../types';

export const AdminSettingsPage: React.FC = () => {
  const [collegeHours, setCollegeHours] = useState('09:00 - 17:00');
  const [whatsAppSandbox, setWhatsAppSandbox] = useState(true);
  const [llmBudget, setLlmBudget] = useState('100,000');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New user form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('COORDINATOR');
  const [addingUser, setAddingUser] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsersList(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load system users');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveSettings = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      await api.createUser({
        email: newEmail,
        fullName: newFullName,
        password: newPassword,
        role: newRole,
      });
      setShowAddModal(false);
      setNewEmail('');
      setNewFullName('');
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleToggleUserStatus = async (u: User) => {
    try {
      await api.updateUser(u.id, { active: !u.active });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.deleteUser(id);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-ink">System Administration & Access Control</h2>
        <p className="text-xs text-muted mt-1">
          RSCOE department operating parameters, API credentials, and institutional role accounts.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600" /> Operational parameters updated successfully!
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" /> {error}
        </div>
      )}

      {/* College & Department Parameters */}
      <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-ink flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Operational Parameters
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-muted mb-1">Department</label>
            <input
              type="text"
              disabled
              value="Department of Computer Engineering"
              className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-semibold opacity-70"
            />
          </div>
          <div>
            <label className="block font-medium text-muted mb-1">Institution</label>
            <input
              type="text"
              disabled
              value="JSPM's Rajarshi Shahu College of Engineering, Pune"
              className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-semibold opacity-70"
            />
          </div>
          <div>
            <label className="block font-medium text-muted mb-1">College Daily Operating Hours</label>
            <input
              type="text"
              value={collegeHours}
              onChange={(e) => setCollegeHours(e.target.value)}
              className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-semibold"
            />
          </div>
          <div>
            <label className="block font-medium text-muted mb-1">Standard Practical Session Blocks</label>
            <input
              type="text"
              disabled
              value="09:00-11:00, 11:15-13:15, 14:00-16:00"
              className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-semibold opacity-70"
            />
          </div>
        </div>
      </div>

      {/* WhatsApp & LLM Integrations */}
      <div className="bg-surface p-5 rounded-xl border border-border shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-ink flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" /> API Integrations & Simulation
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-muted mb-1">WhatsApp Cloud API Dispatch Mode</label>
            <div className="flex items-center gap-3 pt-1">
              <span className="font-semibold text-ink">Sandbox Mode:</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsAppSandbox}
                  onChange={(e) => setWhatsAppSandbox(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-canvas peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
              <span className="text-[11px] font-bold text-emerald-700">Sandbox Simulator Active</span>
            </div>
          </div>

          <div>
            <label className="block font-medium text-muted mb-1">Monthly LLM Budget (Tokens)</label>
            <input
              type="text"
              value={llmBudget}
              onChange={(e) => setLlmBudget(e.target.value)}
              className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-ink font-semibold"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" /> Save Configuration
          </button>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-canvas border-b border-border flex items-center justify-between">
          <div className="font-bold text-xs text-ink flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Active Platform Users & Roles
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add User
          </button>
        </div>

        {loadingUsers ? (
          <div className="p-8 text-center text-xs text-muted">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading registered accounts...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-canvas/50 border-b border-border text-muted uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-2.5">User Full Name</th>
                  <th className="px-4 py-2.5">Email Identifier</th>
                  <th className="px-4 py-2.5">Assigned Role</th>
                  <th className="px-4 py-2.5">Account Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-canvas/30">
                    <td className="px-4 py-3 font-semibold text-ink flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                        {u.fullName.charAt(0)}
                      </div>
                      {u.fullName}
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-[11px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-tint text-primary border border-primary-border">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        u.active ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
                      }`}>
                        {u.active ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          title={u.active ? 'Disable Account' : 'Enable Account'}
                          className={`p-1.5 rounded hover:bg-canvas transition cursor-pointer ${u.active ? 'text-amber-600' : 'text-emerald-600'}`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          title="Delete User"
                          className="p-1.5 rounded hover:bg-canvas text-red-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl border border-border shadow-lg max-w-md w-full p-6 animate-in fade-in">
            <h3 className="text-base font-bold text-ink mb-1">Create Institutional Account</h3>
            <p className="text-xs text-muted mb-4">Provision a new user account with role-based access.</p>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Prof. Rajesh Kumar"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-ink focus:outline-hidden focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Institutional Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="rkumar@rscoe.edu.in"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-ink focus:outline-hidden focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-ink focus:outline-hidden focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-ink focus:outline-hidden focus:border-primary font-medium"
                >
                  <option value="COORDINATOR">COORDINATOR (Timetable management, solver & publication)</option>
                  <option value="ADMIN">ADMIN (System administration)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-ink hover:bg-canvas transition font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {addingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
