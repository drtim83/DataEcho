'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { mockSchedules, mockJobs } from '@/lib/mock-data';
import { timeAgo, parseCronExpression, formatNumber, formatDuration, formatBytes } from '@/lib/utils';
import type { JobStatus } from '@/types';

export default function SchedulerPage() {
  const [showModal, setShowModal] = useState(false);
  const [jobFilter, setJobFilter] = useState<JobStatus | 'all'>('all');

  const filteredJobs = jobFilter === 'all' ? mockJobs : mockJobs.filter(j => j.status === jobFilter);

  const jobTabs: { key: JobStatus | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: mockJobs.length },
    { key: 'running', label: 'Active', count: mockJobs.filter(j => j.status === 'running').length },
    { key: 'pending', label: 'Pending', count: mockJobs.filter(j => j.status === 'pending').length },
    { key: 'completed', label: 'Completed', count: mockJobs.filter(j => j.status === 'completed').length },
    { key: 'failed', label: 'Failed', count: mockJobs.filter(j => j.status === 'failed').length },
  ];

  return (
    <>
      <TopBar title="Scheduler" subtitle="Manage sync schedules and job queue" />
      <div className="p-8 space-y-6">
        {/* Schedule Cards */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Schedules ({mockSchedules.length})</h3>
          <button onClick={() => setShowModal(true)} className="btn-primary text-xs flex items-center gap-2">
            <span>+</span> Create Schedule
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 stagger-children">
          {mockSchedules.map(schedule => (
            <div key={schedule.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{
                      background: schedule.type === 'cron' ? 'rgba(59, 130, 246, 0.1)' :
                        schedule.type === 'interval' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      border: `1px solid ${schedule.type === 'cron' ? 'rgba(59, 130, 246, 0.2)' :
                        schedule.type === 'interval' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                    }}>
                    {schedule.type === 'cron' ? '🕐' : schedule.type === 'interval' ? '⏱' : '⚡'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{schedule.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{schedule.pipeline?.name}</p>
                  </div>
                </div>
                {/* Toggle */}
                <button
                  className="w-11 h-6 rounded-full relative transition-colors"
                  style={{
                    background: schedule.enabled ? 'var(--color-accent-teal)' : 'var(--color-bg-elevated)',
                  }}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ left: schedule.enabled ? '24px' : '4px' }}></div>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Schedule</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {schedule.expression ? parseCronExpression(schedule.expression) :
                      schedule.interval_ms ? `Every ${formatDuration(schedule.interval_ms)}` :
                      schedule.trigger_event || 'Manual'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Last Run</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {schedule.last_run ? timeAgo(schedule.last_run) : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Next Run</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: schedule.next_run ? 'var(--color-accent-teal)' : 'var(--color-text-muted)' }}>
                    {schedule.next_run ? timeAgo(schedule.next_run).replace(' ago', '') : 'Disabled'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <span className={`badge text-[10px] badge-${schedule.type === 'cron' ? 'blue' : schedule.type === 'interval' ? 'purple' : 'amber'}`}>
                  {schedule.type.toUpperCase()}
                </span>
                <span className="badge text-[10px] badge-teal">{schedule.timezone}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Job Queue */}
        <div>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Job Queue</h3>
          {/* Tabs */}
          <div className="flex items-center gap-2 mb-4">
            {jobTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setJobFilter(tab.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: jobFilter === tab.key ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  color: jobFilter === tab.key ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
                  border: `1px solid ${jobFilter === tab.key ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-subtle)'}`,
                }}>
                {tab.label} <span className="opacity-60 ml-1">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Job Table */}
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  {['Pipeline', 'Status', 'Triggered', 'Records', 'Data Transfer', 'Duration', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => (
                  <tr key={job.id} className="table-row" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{job.pipeline?.name || job.pipeline_id}</td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{timeAgo(job.triggered_at)}</td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {formatNumber(job.records_processed)}
                      {job.records_failed > 0 && <span className="ml-1" style={{ color: 'var(--color-accent-coral)' }}>({job.records_failed} err)</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatBytes(job.bytes_transferred)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {job.completed_at && job.started_at
                        ? formatDuration(new Date(job.completed_at).getTime() - new Date(job.started_at).getTime())
                        : job.started_at ? 'Running...' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {job.status === 'running' && (
                        <button className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>Cancel</button>
                      )}
                      {job.status === 'failed' && (
                        <button className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-accent-blue)' }}>Retry</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Schedule Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="glass-strong rounded-2xl p-6 w-full max-w-lg animate-fade-in-scale">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Create Schedule</h3>
                <button onClick={() => setShowModal(false)} className="text-lg" style={{ color: 'var(--color-text-muted)' }}>✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Pipeline</label>
                  <select className="input-field" style={{ background: 'var(--color-bg-primary)' }}>
                    {mockSchedules.map(s => <option key={s.pipeline_id}>{s.pipeline?.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Schedule Type</label>
                  <div className="flex gap-2">
                    {['Cron', 'Interval', 'Event'].map(t => (
                      <button key={t} className="btn-secondary flex-1 text-xs">{t === 'Cron' ? '🕐' : t === 'Interval' ? '⏱' : '⚡'} {t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Cron Expression</label>
                  <input className="input-field font-mono" placeholder="*/15 * * * *" defaultValue="*/15 * * * *" />
                  <p className="text-[10px] mt-1" style={{ color: 'var(--color-accent-teal)' }}>→ Every 15 minutes</p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Timezone</label>
                  <select className="input-field" style={{ background: 'var(--color-bg-primary)' }}>
                    <option>UTC</option><option>America/New_York</option><option>Europe/London</option><option>Asia/Tokyo</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn-primary flex-1" onClick={() => setShowModal(false)}>Create Schedule</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
