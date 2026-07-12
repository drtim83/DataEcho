'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatNumber, formatDuration, timeAgo, getConnectorIcon, getDirectionLabel, getDirectionColor } from '@/lib/utils';
import type { Pipeline, AuditLog } from '@/types';

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      </div>
    </div>
  );
}

interface HourBucket { hour: string; cloud: number; onPrem: number; bidirectional: number; }

function ThroughputChart({ data }: { data: HourBucket[] | null }) {
  const chartH = 180;
  const chartW = 100;

  const legend = (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-1 rounded-full" style={{ background: 'var(--color-accent-teal)' }}></div>
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Cloud-bound</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-1 rounded-full" style={{ background: 'var(--color-accent-amber)' }}></div>
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>On-Prem-bound</span>
      </div>
    </div>
  );

  if (!data) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Throughput (24h)</h3>
          {legend}
        </div>
        <div style={{ height: chartH }} />
      </div>
    );
  }

  const maxVal = Math.max(1, ...data.map((d) => d.cloud + d.onPrem));

  const cloudPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${(i / (data.length - 1)) * chartW} ${100 - (d.cloud / maxVal) * 100}`).join(' ');
  const onPremPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${(i / (data.length - 1)) * chartW} ${100 - (d.onPrem / maxVal) * 100}`).join(' ');

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Throughput (24h)</h3>
        {legend}
      </div>
      <svg viewBox={`0 0 ${chartW} 100`} className="w-full" style={{ height: chartH }} preserveAspectRatio="none">
        <path d={`${cloudPath} L ${chartW} 100 L 0 100 Z`} fill="rgba(20, 184, 166, 0.1)" />
        <path d={cloudPath} fill="none" stroke="var(--color-accent-teal)" strokeWidth="0.8" />
        <path d={`${onPremPath} L ${chartW} 100 L 0 100 Z`} fill="rgba(245, 158, 11, 0.08)" />
        <path d={onPremPath} fill="none" stroke="var(--color-accent-amber)" strokeWidth="0.8" />
        {[25, 50, 75].map((y) => (
          <line key={y} x1="0" y1={y} x2={chartW} y2={y} stroke="rgba(148,163,184,0.06)" strokeWidth="0.3" />
        ))}
      </svg>
      <div className="flex justify-between mt-2">
        {['24h ago', '18h ago', '12h ago', '6h ago', 'Now'].map((l) => (
          <span key={l} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function activityIcon(action: string, status: string) {
  if (status === 'error') return '❌';
  if (action.startsWith('schema.')) return '🧠';
  if (action.includes('delete')) return '🗑️';
  if (action.includes('create')) return '➕';
  if (action.includes('run')) return '✅';
  if (action.includes('test')) return '🔌';
  return '📋';
}

export default function CommandCenter() {
  const [pipelines, setPipelines] = useState<(Pipeline & { source_table?: string; target_table?: string })[]>([]);
  const [runs, setRuns] = useState<{ id: string; pipeline?: { name: string }; started_at: string; status: string }[]>([]);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [hourly, setHourly] = useState<HourBucket[] | null>(null);
  const [overview, setOverview] = useState<{ total_records: number; avg_latency_ms: number; success_rate: number | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/pipelines').then((r) => r.json()),
      fetch('/api/sync-runs').then((r) => r.json()),
      fetch('/api/audit-logs').then((r) => r.json()),
      fetch('/api/analytics').then((r) => r.json()),
    ]).then(([pData, rData, aData, anData]) => {
      setPipelines(pData.pipelines || []);
      setRuns((rData.runs || []).slice(0, 5));
      setActivity((aData.logs || []).slice(0, 8));
      setHourly(anData.hourly_throughput || []);
      setOverview(anData.overview || null);
    }).finally(() => setLoading(false));
  }, []);

  const activePipelines = pipelines.filter((p) => p.status === 'active').length;
  const last24hRecords = (hourly || []).reduce((sum, h) => sum + h.cloud + h.onPrem + h.bidirectional, 0);

  return (
    <>
      <TopBar title="Command Center" subtitle="Real-time overview of your data platform" />
      <div className="p-8 space-y-6 stagger-children">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon="🔗" label="Active Pipelines" value={`${activePipelines}/${pipelines.length}`} />
          <StatCard icon="📊" label="Records Synced (24h)" value={formatNumber(last24hRecords)} />
          <StatCard icon="⚡" label="Avg Latency" value={overview && overview.avg_latency_ms > 0 ? formatDuration(overview.avg_latency_ms) : '—'} />
          <StatCard icon="✅" label="Success Rate" value={overview?.success_rate != null ? `${overview.success_rate}%` : '—'} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Throughput Chart */}
          <div className="col-span-2">
            <ThroughputChart data={hourly} />
          </div>

          {/* Activity Feed */}
          <div className="glass-card p-5 flex flex-col">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Activity Feed</h3>
            <div className="flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: '280px' }}>
              {activity.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <span className="text-sm mt-0.5">{activityIcon(event.action, event.status)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{event.details || event.action}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(event.timestamp)}</p>
                  </div>
                </div>
              ))}
              {!loading && activity.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>No activity yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline Health + Recent Runs */}
        <div className="grid grid-cols-2 gap-4">
          {/* Pipeline Health Grid */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Pipeline Health</h3>
            <div className="space-y-3">
              {pipelines.map((pipeline) => (
                <div key={pipeline.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors"
                  style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{getConnectorIcon(pipeline.source_connector?.type || '')}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>→</span>
                    <span className="text-sm">{getConnectorIcon(pipeline.target_connector?.type || '')}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{pipeline.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`badge badge-${getDirectionColor(pipeline.direction)} text-[10px] px-1.5 py-0`}>
                          {getDirectionLabel(pipeline.direction)}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          {pipeline.last_sync ? timeAgo(pipeline.last_sync) : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={pipeline.status} />
                </div>
              ))}
              {!loading && pipelines.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>No pipelines yet.</p>
              )}
            </div>
          </div>

          {/* Recent Runs */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Recent Runs</h3>
            <div className="space-y-3">
              {runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                  style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{run.status === 'completed' ? '✅' : run.status === 'failed' ? '❌' : '⏳'}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{run.pipeline?.name || 'Unknown pipeline'}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(run.started_at)}</p>
                    </div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
              ))}
              {!loading && runs.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>No runs yet — trigger a pipeline from the Scheduler page.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
