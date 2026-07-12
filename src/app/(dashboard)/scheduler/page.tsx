'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { timeAgo, formatNumber, getDirectionLabel, getDirectionColor } from '@/lib/utils';
import type { Pipeline, JobStatus } from '@/types';

interface SyncRun {
  id: string;
  pipeline_id: string;
  pipeline?: { id: string; name: string; direction: string };
  status: JobStatus;
  records: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export default function SchedulerPage() {
  const [pipelines, setPipelines] = useState<(Pipeline & { source_table?: string; target_table?: string })[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');

  async function loadAll() {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([fetch('/api/pipelines'), fetch('/api/sync-runs')]);
      const pData = await pRes.json();
      const rData = await rRes.json();
      setPipelines(pData.pipelines || []);
      setRuns(rData.runs || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleRun(id: string) {
    setRunningId(id);
    try {
      await fetch(`/api/pipelines/${id}/run`, { method: 'POST' });
      await loadAll();
    } finally {
      setRunningId(null);
    }
  }

  const filteredRuns = statusFilter === 'all' ? runs : runs.filter((r) => r.status === statusFilter);
  const statusTabs: { key: JobStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <>
      <TopBar title="Scheduler" subtitle="Trigger pipeline runs manually and review history" />
      <div className="p-8 space-y-6">
        <div className="p-4 rounded-xl text-xs" style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)', color: 'var(--color-accent-amber)' }}>
          Automatic cron/interval scheduling isn&apos;t implemented — pipelines run synchronously when you click &ldquo;Run Now&rdquo;, capped at 1,000 rows per run.
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Pipelines ({pipelines.length})</h3>
        </div>

        {!loading && pipelines.length === 0 && (
          <div className="glass-card p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No pipelines yet. Create one on the Pipeline Canvas page.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 stagger-children">
          {pipelines.map((p) => (
            <div key={p.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    🔗
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{p.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{p.source_table} → {p.target_table}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Direction</p>
                  <span className={`badge text-[10px] badge-${getDirectionColor(p.direction)} mt-0.5`}>{getDirectionLabel(p.direction)}</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Last Run</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{p.last_sync ? timeAgo(p.last_sync) : 'Never'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Records Synced</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(p.records_synced)}</p>
                </div>
              </div>

              <button
                className="btn-primary text-xs w-full mt-4 disabled:opacity-50"
                onClick={() => handleRun(p.id)}
                disabled={runningId === p.id}
              >
                {runningId === p.id ? 'Running…' : '▶️ Run Now'}
              </button>
            </div>
          ))}
        </div>

        {/* Run History */}
        <div>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Run History</h3>
          <div className="flex items-center gap-2 mb-4">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: statusFilter === tab.key ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  color: statusFilter === tab.key ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
                  border: `1px solid ${statusFilter === tab.key ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-subtle)'}`,
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  {['Pipeline', 'Status', 'Started', 'Records', 'Error'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => (
                  <tr key={run.id} className="table-row" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{run.pipeline?.name || run.pipeline_id}</td>
                    <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{timeAgo(run.started_at)}</td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(run.records)}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-accent-coral)' }}>{run.error || ''}</td>
                  </tr>
                ))}
                {filteredRuns.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No runs yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
