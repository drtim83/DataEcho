'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatNumber, timeAgo, formatDuration, getDirectionLabel, getDirectionColor } from '@/lib/utils';

interface SyncRun {
  id: string;
  pipeline_id: string;
  pipeline?: { id: string; name: string; direction: string };
  status: string;
  records: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export default function MonitorPage() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/sync-runs')
      .then((r) => r.json())
      .then((data) => setRuns(data.runs || []))
      .finally(() => setLoading(false));
  }, []);

  const failedRuns = runs.filter((r) => r.status === 'failed');
  const filteredRuns = directionFilter === 'all' ? runs : runs.filter((r) => r.pipeline?.direction === directionFilter);

  return (
    <>
      <TopBar title="Progress Monitor" subtitle="Sync run history — runs are synchronous, so there are no in-flight jobs to watch live" />
      <div className="p-8 space-y-6">
        {/* Direction Filter */}
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold mr-2" style={{ color: 'var(--color-text-primary)' }}>Sync History</h3>
          {[
            { key: 'all', label: 'All' },
            { key: 'cloud_bound', label: '↑ Cloud-bound' },
            { key: 'on_prem_bound', label: '↓ On-Prem-bound' },
            { key: 'bidirectional', label: '↕ Bidirectional' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setDirectionFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: directionFilter === f.key ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: directionFilter === f.key ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
                border: `1px solid ${directionFilter === f.key ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-subtle)'}`,
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Sync Timeline */}
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Pipeline', 'Direction', 'Status', 'Records', 'Started', 'Duration'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => (
                <tr key={run.id} className="table-row" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{run.pipeline?.name || run.pipeline_id}</td>
                  <td className="px-4 py-3">
                    <span className={`badge badge-${getDirectionColor(run.pipeline?.direction || '')} text-[10px]`}>
                      {getDirectionLabel(run.pipeline?.direction || '')}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(run.records)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{timeAgo(run.started_at)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {run.completed_at ? formatDuration(new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) : 'In progress…'}
                  </td>
                </tr>
              ))}
              {!loading && filteredRuns.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No runs yet. Trigger a pipeline from the Scheduler page.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Error Panel */}
        {failedRuns.length > 0 && (
          <div className="glass-card p-5" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-accent-coral)' }}>
              ❌ Recent Errors
            </h3>
            {failedRuns.map((run) => (
              <div key={run.id} className="p-3 rounded-xl mb-2" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{run.pipeline?.name || run.pipeline_id}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(run.started_at)}</span>
                </div>
                <p className="text-xs font-mono" style={{ color: 'var(--color-accent-coral)' }}>{run.error}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
