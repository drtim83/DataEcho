'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { formatDate } from '@/lib/utils';

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export default function TeamPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myId, setMyId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [meRes, listRes] = await Promise.all([fetch('/api/profile'), fetch('/api/profiles')]);
      const me = await meRes.json();
      const list = await listRes.json();
      setMyId(me.profile?.id || '');
      setIsAdmin(me.profile?.role === 'admin');
      setProfiles(list.profiles || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleRoleChange(id: string, role: 'admin' | 'user') {
    setUpdatingId(id);
    setError('');
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      setProfiles((prev) => prev.map((p) => (p.id === id ? data.profile : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
      <TopBar title="Team" subtitle="Manage account roles" />
      <div className="p-8 space-y-6">
        {!isAdmin && !loading && (
          <div className="p-4 rounded-xl text-xs" style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.15)', color: 'var(--color-accent-blue)' }}>
            You can view the team, but only admins can change roles.
          </div>
        )}

        <div className="p-4 rounded-xl text-xs" style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)', color: 'var(--color-accent-amber)' }}>
          New accounts are created in the Supabase dashboard (Authentication → Users → Add user), not here — this page only assigns roles to accounts that already exist.
        </div>

        {error && (
          <div className="text-sm py-2 px-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>{error}</div>
        )}

        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Email', 'Role', 'Joined', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="table-row" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {p.email} {p.id === myId && <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[10px] ${p.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>{p.role}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    {isAdmin && (
                      <select
                        className="input-field text-xs py-1"
                        style={{ background: 'var(--color-bg-primary)', width: 'auto' }}
                        value={p.role}
                        disabled={updatingId === p.id || (p.id === myId)}
                        onChange={(e) => handleRoleChange(p.id, e.target.value as 'admin' | 'user')}
                      >
                        <option value="admin">admin</option>
                        <option value="user">user</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && profiles.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No accounts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
