'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { mockAuditLogs } from '@/lib/mock-data';
import { formatDateTime, getDirectionLabel, getDirectionColor } from '@/lib/utils';

export default function LogsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  const filtered = mockAuditLogs.filter(log => {
    const matchesSearch = search === '' ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.pipeline_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedLogData = mockAuditLogs.find(l => l.id === selectedLog);

  return (
    <>
      <TopBar title="Audit Trail" subtitle="Complete operational history" />
      <div className="p-8 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="input-field pl-9"
              style={{ background: 'var(--color-bg-surface)' }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
          </div>

          <div className="flex items-center gap-2">
            {['all', 'success', 'error', 'warning', 'info'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                style={{
                  background: statusFilter === s ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  color: statusFilter === s ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
                  border: `1px solid ${statusFilter === s ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-subtle)'}`,
                }}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          <button className="btn-secondary text-xs flex items-center gap-1.5">
            📥 Export CSV
          </button>
        </div>

        {/* Logs Table */}
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Timestamp', 'Pipeline', 'Action', 'Direction', 'Status', 'Actor', 'Records', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr
                  key={log.id}
                  className="table-row cursor-pointer"
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    background: selectedLog === log.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                  }}
                  onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
                >
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{formatDateTime(log.timestamp)}</td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{log.pipeline_name || '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{log.action}</td>
                  <td className="px-4 py-3">
                    {log.direction ? (
                      <span className={`badge badge-${getDirectionColor(log.direction)} text-[10px]`}>
                        {getDirectionLabel(log.direction)}
                      </span>
                    ) : <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{log.actor}</td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {log.records_affected != null ? log.records_affected.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-accent-blue)' }}>
                    {selectedLog === log.id ? '▼' : '▶'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Drawer */}
        {selectedLogData && (
          <div className="glass-card p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Log Detail</h3>
              <button onClick={() => setSelectedLog(null)} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Event ID', value: selectedLogData.id },
                { label: 'Timestamp', value: formatDateTime(selectedLogData.timestamp) },
                { label: 'Pipeline', value: selectedLogData.pipeline_name || 'N/A' },
                { label: 'Action', value: selectedLogData.action },
                { label: 'Actor', value: selectedLogData.actor },
                { label: 'Status', value: selectedLogData.status },
                { label: 'Direction', value: selectedLogData.direction ? getDirectionLabel(selectedLogData.direction) : 'N/A' },
                { label: 'Records Affected', value: selectedLogData.records_affected?.toLocaleString() || 'N/A' },
              ].map(field => (
                <div key={field.label}>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{field.label}</p>
                  <p className="text-sm mt-0.5 font-mono" style={{ color: 'var(--color-text-primary)' }}>{field.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Details</p>
              <p className="text-sm font-mono p-3 rounded-lg" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)' }}>
                {selectedLogData.details}
              </p>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: mockAuditLogs.length, color: 'var(--color-accent-blue)' },
            { label: 'Successes', value: mockAuditLogs.filter(l => l.status === 'success').length, color: 'var(--color-accent-teal)' },
            { label: 'Errors', value: mockAuditLogs.filter(l => l.status === 'error').length, color: 'var(--color-accent-coral)' },
            { label: 'Warnings', value: mockAuditLogs.filter(l => l.status === 'warning').length, color: 'var(--color-accent-amber)' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
