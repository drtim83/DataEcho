'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { mockAnalyticsOverview, mockDailyStats, mockConnectorUsage } from '@/lib/mock-data';
import { formatNumber, formatDuration, getConnectorIcon } from '@/lib/utils';

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const path = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 60;
    const y = 20 - ((v - min) / range) * 18;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 60 22" className="w-16 h-5">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const analytics = mockAnalyticsOverview;
  const stats = mockDailyStats;

  const syncTrend = stats.map(s => s.total_syncs);
  const recordTrend = stats.map(s => s.total_records);
  const latencyTrend = stats.map(s => s.avg_latency_ms);
  const errorTrend = stats.map(s => s.fail_count);

  // Chart dimensions
  const chartW = 100;

  // Sync Trend Chart (area)
  const maxSyncs = Math.max(...stats.map(s => s.total_syncs));
  const successPath = stats.map((s, i) => {
    const x = (i / (stats.length - 1)) * chartW;
    const y = 100 - (s.success_count / maxSyncs) * 90;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const failPath = stats.map((s, i) => {
    const x = (i / (stats.length - 1)) * chartW;
    const y = 100 - (s.fail_count / maxSyncs) * 90;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Connector utilization
  const totalConnRecords = mockConnectorUsage.reduce((s, c) => s + c.total_records, 0);

  // Latency heatmap data
  const heatmapData = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => 1500 + Math.random() * 4000 + (hour >= 8 && hour <= 18 ? 2000 : 0))
  );
  const maxLatency = Math.max(...heatmapData.flat());

  return (
    <>
      <TopBar title="Analytics & Stats" subtitle="Platform-wide performance insights" />
      <div className="p-8 space-y-6">
        {/* Time Range */}
        <div className="flex items-center gap-2">
          {['Today', '7 Days', '30 Days', '90 Days'].map(range => {
            const key = range === 'Today' ? '1d' : range === '7 Days' ? '7d' : range === '30 Days' ? '30d' : '90d';
            return (
              <button key={key} onClick={() => setTimeRange(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: timeRange === key ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  color: timeRange === key ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
                  border: `1px solid ${timeRange === key ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-subtle)'}`,
                }}>
                {range}
              </button>
            );
          })}
        </div>

        {/* Hero KPIs */}
        <div className="grid grid-cols-6 gap-3 stagger-children">
          {[
            { label: 'Total Syncs', value: formatNumber(analytics.total_syncs), sub: '~95/day avg', color: 'var(--color-accent-blue)', trend: syncTrend },
            { label: 'Records Moved', value: formatNumber(analytics.total_records), sub: '~23.5M total', color: 'var(--color-accent-teal)', trend: recordTrend },
            { label: 'Avg Latency', value: formatDuration(analytics.avg_latency_ms), sub: '↓ 8% vs prev', color: 'var(--color-accent-amber)', trend: latencyTrend },
            { label: 'Success Rate', value: `${analytics.success_rate}%`, sub: '↑ 0.5% vs prev', color: 'var(--color-accent-teal)', trend: syncTrend },
            { label: 'Active Pipelines', value: `${analytics.active_pipelines}/${analytics.total_pipelines}`, sub: '3 active', color: 'var(--color-accent-purple)', trend: syncTrend },
            { label: 'Uptime', value: `${analytics.uptime_pct}%`, sub: 'Last 30 days', color: 'var(--color-accent-teal)', trend: syncTrend },
          ].map((kpi, i) => (
            <div key={i} className="glass-card p-4">
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>{kpi.label}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{kpi.sub}</p>
                </div>
                <MiniSparkline data={kpi.trend} color={kpi.color} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Sync Trend Chart */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Sync Trends</h3>
            <svg viewBox={`0 0 ${chartW} 100`} className="w-full h-[200px]" preserveAspectRatio="none">
              <path d={`${successPath} L ${chartW} 100 L 0 100 Z`} fill="rgba(20, 184, 166, 0.1)" />
              <path d={successPath} fill="none" stroke="var(--color-accent-teal)" strokeWidth="0.6" />
              <path d={`${failPath} L ${chartW} 100 L 0 100 Z`} fill="rgba(239, 68, 68, 0.08)" />
              <path d={failPath} fill="none" stroke="var(--color-accent-coral)" strokeWidth="0.6" />
              {[25, 50, 75].map(y => <line key={y} x1="0" y1={y} x2={chartW} y2={y} stroke="rgba(148,163,184,0.06)" strokeWidth="0.3" />)}
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
          </div>

          {/* Data Volume */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Data Volume by Day</h3>
            <div className="flex items-end gap-1 h-[200px]">
              {stats.slice(-15).map((day, i) => {
                const maxRec = Math.max(...stats.map(s => s.total_records));
                const height = (day.total_records / maxRec) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div className="w-full rounded-t-sm transition-all group-hover:opacity-80" style={{
                      height: `${height}%`,
                      background: 'linear-gradient(to top, var(--color-accent-blue), var(--color-accent-teal))',
                      minHeight: '4px',
                    }}></div>
                    <span className="text-[8px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{i + 16}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Connector Utilization Donut */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Connector Utilization</h3>
            <div className="flex items-center justify-center relative">
              <svg viewBox="0 0 100 100" className="w-40 h-40">
                {(() => {
                  let offset = 0;
                  const colors = ['#3b82f6', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
                  return mockConnectorUsage.map((conn, i) => {
                    const pct = (conn.total_records / totalConnRecords) * 100;
                    const circumference = 2 * Math.PI * 35;
                    const strokeDash = (pct / 100) * circumference;
                    const el = (
                      <circle
                        key={conn.connector_id}
                        cx="50" cy="50" r="35"
                        fill="none"
                        stroke={colors[i % colors.length]}
                        strokeWidth="8"
                        strokeDasharray={`${strokeDash} ${circumference}`}
                        strokeDashoffset={-offset * (circumference / 100) * (2 * Math.PI / circumference) * 100 / (2 * Math.PI) * circumference / 100}
                        transform={`rotate(${(offset / 100) * 360 - 90} 50 50)`}
                        strokeLinecap="round"
                        opacity={0.85}
                      />
                    );
                    offset += pct;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute text-center">
                <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>6</p>
                <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>connectors</p>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              {mockConnectorUsage.slice(0, 4).map(conn => (
                <div key={conn.connector_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{getConnectorIcon(conn.connector_type)}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{conn.connector_name}</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(conn.total_records)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Direction Split */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Direction Split</h3>
            <div className="flex items-center justify-center mt-6">
              <div className="relative w-40 h-40">
                {(() => {
                  const total = analytics.direction_split.cloud_bound_records + analytics.direction_split.on_prem_bound_records;
                  const cloudPct = (analytics.direction_split.cloud_bound_records / total) * 100;
                  return (
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-bg-elevated)" strokeWidth="12" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-accent-teal)" strokeWidth="12"
                        strokeDasharray={`${cloudPct * 2.51} ${251 - cloudPct * 2.51}`}
                        transform="rotate(-90 50 50)"
                        strokeLinecap="round" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-accent-amber)" strokeWidth="12"
                        strokeDasharray={`${(100 - cloudPct) * 2.51} ${251 - (100 - cloudPct) * 2.51}`}
                        transform={`rotate(${cloudPct * 3.6 - 90} 50 50)`}
                        strokeLinecap="round" />
                    </svg>
                  );
                })()}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {Math.round((analytics.direction_split.cloud_bound_records / (analytics.direction_split.cloud_bound_records + analytics.direction_split.on_prem_bound_records)) * 100)}%
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
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(analytics.direction_split.cloud_bound_records)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-accent-amber)' }}></div>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>↓ On-Prem-bound</span>
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(analytics.direction_split.on_prem_bound_records)}</span>
              </div>
            </div>
          </div>

          {/* Latency Heatmap */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Latency Heatmap</h3>
            <div className="space-y-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, di) => (
                <div key={day} className="flex items-center gap-1">
                  <span className="text-[9px] w-6" style={{ color: 'var(--color-text-muted)' }}>{day}</span>
                  <div className="flex gap-[2px] flex-1">
                    {heatmapData[di].map((val, hi) => {
                      const intensity = val / maxLatency;
                      return (
                        <div
                          key={hi}
                          className="flex-1 h-3 rounded-[2px] transition-colors"
                          title={`${day} ${hi}:00 — ${Math.round(val)}ms`}
                          style={{
                            background: intensity > 0.7 ? `rgba(239, 68, 68, ${0.3 + intensity * 0.5})` :
                              intensity > 0.4 ? `rgba(245, 158, 11, ${0.2 + intensity * 0.4})` :
                              `rgba(20, 184, 166, ${0.1 + intensity * 0.3})`,
                          }}
                        ></div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between mt-2 px-7">
                <span className="text-[8px]" style={{ color: 'var(--color-text-muted)' }}>12AM</span>
                <span className="text-[8px]" style={{ color: 'var(--color-text-muted)' }}>12PM</span>
                <span className="text-[8px]" style={{ color: 'var(--color-text-muted)' }}>11PM</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Low</span>
              <div className="flex gap-[2px]">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map(i => (
                  <div key={i} className="w-4 h-2 rounded-[1px]" style={{
                    background: i > 0.7 ? `rgba(239, 68, 68, ${0.3 + i * 0.5})` :
                      i > 0.4 ? `rgba(245, 158, 11, ${0.2 + i * 0.4})` :
                      `rgba(20, 184, 166, ${0.1 + i * 0.3})`,
                  }}></div>
                ))}
              </div>
              <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>High</span>
            </div>
          </div>
        </div>

        {/* Pipeline Leaderboard */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Pipeline Leaderboard</h3>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Pipeline', 'Total Syncs', 'Records', 'Avg Latency', 'Success Rate', 'Reliability'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Customer 360 Sync', syncs: 1247, records: 2847392, latency: 2100, rate: 99.1 },
                { name: 'Financial Reconciliation', syncs: 892, records: 15623841, latency: 3800, rate: 96.8 },
                { name: 'ML Feature Backfill', syncs: 456, records: 892104, latency: 4200, rate: 97.5 },
                { name: 'Inventory Lakehouse', syncs: 252, records: 4210556, latency: 2900, rate: 98.2 },
              ].map((p, i) => (
                <tr key={i} className="table-row" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{p.name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatNumber(p.syncs)}</td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(p.records)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDuration(p.latency)}</td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: p.rate >= 98 ? 'var(--color-accent-teal)' : 'var(--color-accent-amber)' }}>{p.rate}%</td>
                  <td className="px-4 py-3">
                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${p.rate}%`,
                        background: p.rate >= 98 ? 'var(--color-accent-teal)' : 'var(--color-accent-amber)',
                      }}></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
