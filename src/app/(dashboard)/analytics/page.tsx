'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { formatNumber, formatDuration, getConnectorIcon } from '@/lib/utils';

interface DailyStat { date: string; total_syncs: number; success_count: number; fail_count: number; total_records: number; avg_latency_ms: number; }
interface ConnectorUsage { connector_id: string; connector_name: string; connector_type: string; total_pipelines: number; total_syncs: number; total_records: number; }
interface LeaderboardRow { pipeline_id: string; name: string; total_syncs: number; records: number; avg_latency_ms: number; success_rate: number; }
interface Analytics {
  overview: { total_syncs: number; total_records: number; avg_latency_ms: number; success_rate: number | null; active_pipelines: number; total_pipelines: number };
  daily_stats: DailyStat[];
  connector_usage: ConnectorUsage[];
  direction_split: { cloud_bound_records: number; on_prem_bound_records: number; bidirectional_records: number };
  pipeline_leaderboard: LeaderboardRow[];
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-[200px] flex items-center justify-center text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics').then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <>
        <TopBar title="Analytics & Stats" subtitle="Platform-wide performance insights" />
        <div className="p-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>{loading ? 'Loading…' : 'No data available.'}</div>
      </>
    );
  }

  const { overview, daily_stats, connector_usage, direction_split, pipeline_leaderboard } = data;
  const chartW = 100;
  const hasDaily = daily_stats.length > 1;
  const maxSyncs = Math.max(1, ...daily_stats.map((s) => s.total_syncs));
  const successPath = hasDaily ? daily_stats.map((s, i) => `${i === 0 ? 'M' : 'L'} ${(i / (daily_stats.length - 1)) * chartW} ${100 - (s.success_count / maxSyncs) * 90}`).join(' ') : '';
  const failPath = hasDaily ? daily_stats.map((s, i) => `${i === 0 ? 'M' : 'L'} ${(i / (daily_stats.length - 1)) * chartW} ${100 - (s.fail_count / maxSyncs) * 90}`).join(' ') : '';

  const totalDirectionRecords = direction_split.cloud_bound_records + direction_split.on_prem_bound_records + direction_split.bidirectional_records;
  const totalConnRecords = connector_usage.reduce((s, c) => s + c.total_records, 0);

  return (
    <>
      <TopBar title="Analytics & Stats" subtitle="Platform-wide performance insights, computed from real sync history" />
      <div className="p-8 space-y-6">
        {/* Hero KPIs */}
        <div className="grid grid-cols-5 gap-3 stagger-children">
          {[
            { label: 'Total Syncs', value: formatNumber(overview.total_syncs), color: 'var(--color-accent-blue)' },
            { label: 'Records Moved', value: formatNumber(overview.total_records), color: 'var(--color-accent-teal)' },
            { label: 'Avg Latency', value: overview.avg_latency_ms > 0 ? formatDuration(overview.avg_latency_ms) : '—', color: 'var(--color-accent-amber)' },
            { label: 'Success Rate', value: overview.success_rate != null ? `${overview.success_rate}%` : '—', color: 'var(--color-accent-teal)' },
            { label: 'Active Pipelines', value: `${overview.active_pipelines}/${overview.total_pipelines}`, color: 'var(--color-accent-purple)' },
          ].map((kpi, i) => (
            <div key={i} className="glass-card p-4">
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>{kpi.label}</p>
              <p className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Sync Trend Chart */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Sync Trends</h3>
            {hasDaily ? (
              <>
                <svg viewBox={`0 0 ${chartW} 100`} className="w-full h-[200px]" preserveAspectRatio="none">
                  <path d={`${successPath} L ${chartW} 100 L 0 100 Z`} fill="rgba(20, 184, 166, 0.1)" />
                  <path d={successPath} fill="none" stroke="var(--color-accent-teal)" strokeWidth="0.6" />
                  <path d={`${failPath} L ${chartW} 100 L 0 100 Z`} fill="rgba(239, 68, 68, 0.08)" />
                  <path d={failPath} fill="none" stroke="var(--color-accent-coral)" strokeWidth="0.6" />
                  {[25, 50, 75].map((y) => <line key={y} x1="0" y1={y} x2={chartW} y2={y} stroke="rgba(148,163,184,0.06)" strokeWidth="0.3" />)}
                </svg>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 rounded-full" style={{ background: 'var(--color-accent-teal)' }}></div>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Successful</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 rounded-full" style={{ background: 'var(--color-accent-coral)' }}></div>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Failed</span>
                  </div>
                </div>
              </>
            ) : <EmptyChart label="Not enough sync history yet to chart a trend." />}
          </div>

          {/* Data Volume */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Data Volume by Day</h3>
            {daily_stats.length > 0 ? (
              <div className="flex items-end gap-1 h-[200px]">
                {daily_stats.slice(-15).map((day, i) => {
                  const maxRec = Math.max(1, ...daily_stats.map((s) => s.total_records));
                  const height = (day.total_records / maxRec) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div className="w-full rounded-t-sm transition-all group-hover:opacity-80" style={{
                        height: `${height}%`, background: 'linear-gradient(to top, var(--color-accent-blue), var(--color-accent-teal))', minHeight: '4px',
                      }} title={`${day.date}: ${formatNumber(day.total_records)} records`}></div>
                      <span className="text-[8px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{day.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyChart label="No sync runs recorded yet." />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Connector Utilization */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Connector Utilization</h3>
            {connector_usage.length === 0 ? <EmptyChart label="No connector usage recorded yet." /> : (
              <>
                <div className="flex items-center justify-center relative">
                  <svg viewBox="0 0 100 100" className="w-40 h-40">
                    {(() => {
                      let offset = 0;
                      const colors = ['#3b82f6', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
                      return connector_usage.map((conn, i) => {
                        const pct = totalConnRecords > 0 ? (conn.total_records / totalConnRecords) * 100 : 0;
                        const circumference = 2 * Math.PI * 35;
                        const strokeDash = (pct / 100) * circumference;
                        const el = (
                          <circle key={conn.connector_id} cx="50" cy="50" r="35" fill="none" stroke={colors[i % colors.length]} strokeWidth="8"
                            strokeDasharray={`${strokeDash} ${circumference}`}
                            transform={`rotate(${(offset / 100) * 360 - 90} 50 50)`}
                            strokeLinecap="round" opacity={0.85} />
                        );
                        offset += pct;
                        return el;
                      });
                    })()}
                  </svg>
                  <div className="absolute text-center">
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{connector_usage.length}</p>
                    <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>connectors</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  {connector_usage.slice(0, 4).map((conn) => (
                    <div key={conn.connector_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{getConnectorIcon(conn.connector_type)}</span>
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{conn.connector_name}</span>
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(conn.total_records)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Direction Split */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Direction Split</h3>
            {totalDirectionRecords === 0 ? <EmptyChart label="No records synced yet." /> : (
              <>
                <div className="flex items-center justify-center mt-6">
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-bg-elevated)" strokeWidth="12" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-accent-teal)" strokeWidth="12"
                        strokeDasharray={`${(direction_split.cloud_bound_records / totalDirectionRecords) * 251} 251`}
                        transform="rotate(-90 50 50)" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {Math.round((direction_split.cloud_bound_records / totalDirectionRecords) * 100)}%
                      </p>
                      <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>cloud-bound</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-accent-teal)' }}></div>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>↑ Cloud-bound</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(direction_split.cloud_bound_records)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-accent-amber)' }}></div>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>↓ On-Prem-bound</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(direction_split.on_prem_bound_records)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-accent-purple)' }}></div>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>↕ Bidirectional</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(direction_split.bidirectional_records)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pipeline Leaderboard */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Pipeline Leaderboard</h3>
          {pipeline_leaderboard.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>No pipeline runs yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  {['Pipeline', 'Total Syncs', 'Records', 'Avg Latency', 'Success Rate', 'Reliability'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipeline_leaderboard.map((p) => (
                  <tr key={p.pipeline_id} className="table-row" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{p.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatNumber(p.total_syncs)}</td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(p.records)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{p.avg_latency_ms > 0 ? formatDuration(p.avg_latency_ms) : '—'}</td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: p.success_rate >= 98 ? 'var(--color-accent-teal)' : 'var(--color-accent-amber)' }}>{p.success_rate}%</td>
                    <td className="px-4 py-3">
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
                        <div className="h-full rounded-full" style={{ width: `${p.success_rate}%`, background: p.success_rate >= 98 ? 'var(--color-accent-teal)' : 'var(--color-accent-amber)' }}></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
