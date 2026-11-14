import React, { useState, useEffect } from 'react';
import { Search, Power } from 'lucide-react';
import { authApi } from '../../services/api';
import type { User } from '../../types';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await authApi.getAllUsers();
      setUsers(Array.isArray(data) ? data : ((data as any)?.users || []));
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user: User) => {
    setActionUserId(user._id);
    try {
      await authApi.toggleUserStatus(user._id, !user.isActive);
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, isActive: !u.isActive } : u))
      );
    } catch (err) {
      console.error('Failed to update user status:', err);
    } finally {
      setActionUserId(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            User Access Control & Staff Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Admin portal to view registered roles, verify active staff, and control system authorization.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or role..."
          className="w-full text-xs outline-none bg-transparent"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <LoadingSpinner message="Querying staff & customer accounts..." />
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No accounts match the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-5">Name & Email</th>
                  <th className="py-3 px-5">Role</th>
                  <th className="py-3 px-5">Phone Number</th>
                  <th className="py-3 px-5">Registered On</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge
                        variant={
                          u.role === 'ADMIN'
                            ? 'purple'
                            : u.role === 'PHARMACIST'
                            ? 'success'
                            : 'info'
                        }
                        size="sm"
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-600">
                      {u.phone || '—'}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <Badge variant={u.isActive ? 'success' : 'danger'} size="sm">
                        {u.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        disabled={actionUserId === u._id}
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 mx-auto ${
                          u.isActive
                            ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {u.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
