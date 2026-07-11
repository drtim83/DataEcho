'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { mockJobs, mockSyncRuns } from '@/lib/mock-data';
import { formatNumber, formatBytes, formatDuration, timeAgo, getDirectionLabel, getDirectionColor } from '@/lib/utils';

function StageBar({ name, status, progress, recordsIn, recordsOut }: {
  name: string; status: string; progress: number; recordsIn: number; recordsOut: number;
}) {
  const stageLabels: Record<string, string> = { extract: 'Extract', transform: 'Transform', validate: 'Validate', load: 'Load' };
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>{stageLabels[name] || name}</span>
        <span className="text-[10px]" style={{
          color: status === 'completed' ? 'var(--color-accent-teal)' :
            status === 'running' ? 'var(--color-accent-blue)' : 'var(--color-text-muted)'
        }}>
          {status === 'completed' ? '✓' : status === 'running' ? `${progress}%` : '—'}
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
        <div className="h-full rounded-full transition-all duration-1000" style={{
          width: `${progress}%`,
          background: status === 'completed' ? 'var(--color-accent-teal)' :
            status === 'running' ? 'linear-gradient(90deg, var(--color-accent-blue), var(--color-accent-teal))' :
            'var(--color-bg-hover)',
        }}></div>
      </div>
      {(recordsIn > 0 || recordsOut > 0) && (
        <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {formatNumber(recordsIn)} in → {formatNumber(recordsOut)} out
        </p>
      )}
    </div>
  );
}

export default function MonitorPage() {
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  const runningJobs = mockJobs.filter(j => j.status === 'running');
  const recentRuns = mockSyncRuns;
  const filteredRuns = directionFilter === 'all' ? recentRuns :
    recentRuns.filter(r => r.direction === directionFilter);

  return (
    <>
      <TopBar title="Progress Monitor" subtitle="Real-time sync progress and job tracking" />
      <div className="p-8 space-y-6">
        {/* Active Jobs */}
        <div>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            🔄 Active Jobs ({runningJobs.length})
          </h3>
          <div className="grid grid-cols-1 gap-4 stagger-children">
            {runningJobs.map(job => {
              const overallProgress = job.stages
                ? Math.round(job.stages.reduce((s, st) => s + st.progress_pct, 0) / job.stages.length)
                : 50;
              return (
                <div key={job.id} className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h4 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>{job.pipeline?.name}</h4>
                      <span className={`badge badge-${getDirectionColor(job.pipeline?.direction || '')} text-[10px]`}>
                        {getDirectionLabel(job.pipeline?.direction || '')}
                      </span>
                      <StatusBadge status="running" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn-secondary text-[10px] px-3 py-1">⏸ Pause</button>
                      <button className="text-[10px] px-3 py-1 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>✕ Cancel</button>
                    </div>
                  </div>

                  {/* Overall Progress */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Overall Progress</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--color-accent-teal)' }}>{overallProgress}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{
                        width: `${overallProgress}%`,
                        background: 'linear-gradient(90deg, var(--color-accent-blue), var(--color-accent-teal))',
                        boxShadow: '0 0 12px var(--color-accent-blue-glow)',
                      }}></div>
                    </div>
                  </div>

                  {/* Stage Pipeline */}
                  {job.stages && (
                    <div className="flex items-start gap-2 mb-5">
                      {job.stages.map((stage, i) => (
                        <div key={stage.id} className="flex items-start flex-1 gap-2">
                          <StageBar
                            name={stage.stage_name}
                            status={stage.status}
                            progress={stage.progress_pct}
                            recordsIn={stage.records_in}
                            recordsOut={stage.records_out}
                          />
                          {i < job.stages!.length - 1 && (
                            <span className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Live Metrics */}
                  <div className="grid grid-cols-5 gap-4 p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Records</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(job.records_processed)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Transfer</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{formatBytes(job.bytes_transferred)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Rows/sec</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--color-accent-teal)' }}>~8,500</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Errors</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: job.records_failed > 0 ? 'var(--color-accent-coral)' : 'var(--color-text-primary)' }}>
                        {job.records_failed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>ETA</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--color-accent-blue)' }}>~2m 30s</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Direction Filter */}
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold mr-2" style={{ color: 'var(--color-text-primary)' }}>Sync History</h3>
          {[
            { key: 'all', label: 'All' },
            { key: 'cloud_bound', label: '↑ Cloud-bound' },
            { key: 'on_prem_bound', label: '↓ On-Prem-bound' },
            { key: 'bidirectional', label: '↕ Bidirectional' },
          ].map(f => (
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
                {['Pipeline', 'Direction', 'Status', 'Records', 'Started', 'Duration'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map(run => (
                <tr key={run.id} className="table-row" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{run.pipeline?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`badge badge-${getDirectionColor(run.direction)} text-[10px]`}>
                      {getDirectionLabel(run.direction)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(run.records)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{timeAgo(run.started_at)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {run.completed_at
                      ? formatDuration(new Date(run.completed_at).getTime() - new Date(run.started_at).getTime())
                      : 'In progress...'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Error Panel */}
        {mockJobs.filter(j => j.status === 'failed').length > 0 && (
          <div className="glass-card p-5" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-accent-coral)' }}>
              ❌ Recent Errors
            </h3>
            {mockJobs.filter(j => j.status === 'failed').map(job => (
              <div key={job.id} className="p-3 rounded-xl mb-2" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{job.pipeline?.name}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(job.triggered_at)}</span>
                </div>
                <p className="text-xs font-mono" style={{ color: 'var(--color-accent-coral)' }}>{job.error_message}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button className="text-[10px] px-3 py-1 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-accent-blue)' }}>🔄 Retry</button>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>💡 Suggested fix: Extend tablespace or archive old data</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
