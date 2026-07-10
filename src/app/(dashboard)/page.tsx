'use client';

import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { mockPipelines, mockJobs, mockActivityFeed, mockAnalyticsOverview, mockSchedules } from '@/lib/mock-data';
import { formatNumber, formatDuration, timeAgo, getConnectorIcon, getDirectionLabel, getDirectionColor } from '@/lib/utils';

function StatCard({ icon, label, value, trend, trendUp }: { icon: string; label: string; value: string; trend: string; trendUp: boolean }) {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trendUp ? 'badge-teal' : 'badge-coral'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      </div>
    </div>
  );
}

function ThroughputChart() {
  const data = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    cloud: 15000 + Math.sin(i * 0.5) * 8000 + Math.random() * 3000,
    onPrem: 8000 + Math.cos(i * 0.3) * 4000 + Math.random() * 2000,
  }));

  const maxVal = Math.max(...data.map(d => d.cloud + d.onPrem));
  const chartH = 180;
  const chartW = 100;

  const cloudPath = data.map((d, i) => {
    const x = (i / (data.length - 1)) * chartW;
    const y = 100 - (d.cloud / maxVal) * 100;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const onPremPath = data.map((d, i) => {
    const x = (i / (data.length - 1)) * chartW;
    const y = 100 - (d.onPrem / maxVal) * 100;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Throughput (24h)</h3>
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
      </div>
      <svg viewBox={`0 0 ${chartW} 100`} className="w-full" style={{ height: chartH }} preserveAspectRatio="none">
        {/* Cloud area */}
        <path d={`${cloudPath} L ${chartW} 100 L 0 100 Z`} fill="rgba(20, 184, 166, 0.1)" />
        <path d={cloudPath} fill="none" stroke="var(--color-accent-teal)" strokeWidth="0.8" />
        {/* On-prem area */}
        <path d={`${onPremPath} L ${chartW} 100 L 0 100 Z`} fill="rgba(245, 158, 11, 0.08)" />
        <path d={onPremPath} fill="none" stroke="var(--color-accent-amber)" strokeWidth="0.8" />
        {/* Grid lines */}
        {[25, 50, 75].map(y => (
          <line key={y} x1="0" y1={y} x2={chartW} y2={y} stroke="rgba(148,163,184,0.06)" strokeWidth="0.3" />
        ))}
      </svg>
      <div className="flex justify-between mt-2">
        {['12AM', '6AM', '12PM', '6PM', 'Now'].map(l => (
          <span key={l} className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const activePipelines = mockPipelines.filter(p => p.status === 'active').length;
  const runningJobs = mockJobs.filter(j => j.status === 'running');
  const analytics = mockAnalyticsOverview;

  return (
    <>
      <TopBar title="Command Center" subtitle="Real-time overview of your data platform" />
      <div className="p-8 space-y-6 stagger-children">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon="🔗" label="Active Pipelines" value={`${activePipelines}/${mockPipelines.length}`} trend="0%" trendUp={true} />
          <StatCard icon="📊" label="Records Synced (24h)" value={formatNumber(analytics.total_records)} trend="12.3%" trendUp={true} />
          <StatCard icon="⚡" label="Avg Latency" value={formatDuration(analytics.avg_latency_ms)} trend="8%" trendUp={false} />
          <StatCard icon="✅" label="Success Rate" value={`${analytics.success_rate}%`} trend="0.5%" trendUp={true} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Throughput Chart */}
          <div className="col-span-2">
            <ThroughputChart />
          </div>

          {/* Activity Feed */}
          <div className="glass-card p-5 flex flex-col">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Activity Feed</h3>
            <div className="flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: '280px' }}>
              {mockActivityFeed.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <span className="text-sm mt-0.5">{event.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{event.message}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(event.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pipeline Health + Upcoming Schedules */}
        <div className="grid grid-cols-2 gap-4">
          {/* Pipeline Health Grid */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Pipeline Health</h3>
            <div className="space-y-3">
              {mockPipelines.map((pipeline) => (
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
            </div>
          </div>

          {/* Upcoming Schedules */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Upcoming Schedules</h3>
            <div className="space-y-3">
              {mockSchedules.filter(s => s.enabled && s.next_run).slice(0, 5).map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                  style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {schedule.type === 'cron' ? '🕐' : schedule.type === 'interval' ? '⏱' : '⚡'}
                    </span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{schedule.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        Next: {schedule.next_run ? timeAgo(schedule.next_run).replace(' ago', '') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <span className="badge badge-teal text-[10px]">Enabled</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Running Jobs */}
        {runningJobs.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>🔄 Active Syncs</h3>
            <div className="grid grid-cols-2 gap-4">
              {runningJobs.map((job) => {
                const overallProgress = job.stages
                  ? Math.round(job.stages.reduce((sum, s) => sum + s.progress_pct, 0) / job.stages.length)
                  : 50;
                return (
                  <div key={job.id} className="p-4 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{job.pipeline?.name}</p>
                      <StatusBadge status="running" />
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full overflow-hidden mt-3" style={{ background: 'var(--color-bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${overallProgress}%`,
                          background: 'linear-gradient(90deg, var(--color-accent-blue), var(--color-accent-teal))',
                        }} />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{formatNumber(job.records_processed)} records</span>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--color-accent-teal)' }}>{overallProgress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
