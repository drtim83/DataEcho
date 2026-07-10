'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { mockMeteringEvents, mockPipelines } from '@/lib/mock-data';
import { formatNumber, formatBytes, getDirectionLabel, getDirectionColor } from '@/lib/utils';

export default function MeteringPage() {
  const [timeRange, setTimeRange] = useState('30d');

  // Aggregate metering data
  const totalRecords = mockMeteringEvents.reduce((s, e) => s + e.records, 0);
  const totalBytes = mockMeteringEvents.reduce((s, e) => s + e.bytes, 0);
  const totalCost = mockMeteringEvents.reduce((s, e) => s + e.cost_usd, 0);
  const cloudBoundCost = mockMeteringEvents.filter(e => e.direction === 'cloud_bound').reduce((s, e) => s + e.cost_usd, 0);
  const onPremCost = mockMeteringEvents.filter(e => e.direction === 'on_prem_bound').reduce((s, e) => s + e.cost_usd, 0);
  const biCost = mockMeteringEvents.filter(e => e.direction === 'bidirectional').reduce((s, e) => s + e.cost_usd, 0);

  // Daily costs for chart (last 15 days)
  const dailyCosts = Array.from({ length: 15 }, (_, i) => {
    const day = 29 - 14 + i;
    const dayEvents = mockMeteringEvents.filter((_, ei) => Math.floor(ei / 3) === day);
    return {
      day: i + 1,
      cloud: dayEvents.filter(e => e.direction === 'cloud_bound').reduce((s, e) => s + e.cost_usd, 0),
      onPrem: dayEvents.filter(e => e.direction === 'on_prem_bound').reduce((s, e) => s + e.cost_usd, 0),
      bi: dayEvents.filter(e => e.direction === 'bidirectional').reduce((s, e) => s + e.cost_usd, 0),
    };
  });
  const maxDailyCost = Math.max(...dailyCosts.map(d => d.cloud + d.onPrem + d.bi));

  // Per-pipeline costs
  const pipelineCosts = mockPipelines.map(p => {
    const events = mockMeteringEvents.filter(e => e.pipeline_id === p.id);
    return {
      pipeline: p,
      records: events.reduce((s, e) => s + e.records, 0),
      bytes: events.reduce((s, e) => s + e.bytes, 0),
      cost: events.reduce((s, e) => s + e.cost_usd, 0),
      computeMs: events.reduce((s, e) => s + e.compute_ms, 0),
    };
  }).sort((a, b) => b.cost - a.cost);

  return (
    <>
      <TopBar title="Metering Dashboard" subtitle="Usage-based billing and cost tracking" />
      <div className="p-8 space-y-6">
        {/* Time Range */}
        <div className="flex items-center gap-2">
          {['7 Days', '30 Days', '90 Days'].map(range => {
            const key = range === '7 Days' ? '7d' : range === '30 Days' ? '30d' : '90d';
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

        {/* Billing Summary Cards */}
        <div className="grid grid-cols-4 gap-4 stagger-children">
          <div className="glass-card p-5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total Cost (Period)</p>
            <p className="text-3xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>${totalCost.toFixed(2)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-accent-teal)' }}>↓ 5% vs previous period</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Cloud Ingress</p>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-accent-teal)' }}>${cloudBoundCost.toFixed(2)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{Math.round(cloudBoundCost / totalCost * 100)}% of total</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>On-Prem Egress</p>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-accent-amber)' }}>${onPremCost.toFixed(2)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{Math.round(onPremCost / totalCost * 100)}% of total</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Bidirectional</p>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-accent-purple)' }}>${biCost.toFixed(2)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{Math.round(biCost / totalCost * 100)}% of total</p>
          </div>
        </div>

        {/* Cost Over Time Chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Cost by Direction (Daily)</h3>
          <div className="flex items-end gap-1 h-[200px]">
            {dailyCosts.map((day, i) => {
              const total = day.cloud + day.onPrem + day.bi;
              const biH = maxDailyCost > 0 ? (day.bi / maxDailyCost) * 100 : 0;
              const onPremH = maxDailyCost > 0 ? (day.onPrem / maxDailyCost) * 100 : 0;
              const cloudH = maxDailyCost > 0 ? (day.cloud / maxDailyCost) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group" title={`Day ${day.day}: $${total.toFixed(2)}`}>
                  <div className="w-full flex flex-col">
                    <div className="w-full rounded-t-sm" style={{ height: `${biH}%`, background: 'var(--color-accent-purple)', minHeight: biH > 0 ? '2px' : '0' }}></div>
                    <div className="w-full" style={{ height: `${onPremH}%`, background: 'var(--color-accent-amber)', minHeight: onPremH > 0 ? '2px' : '0' }}></div>
                    <div className="w-full" style={{ height: `${cloudH}%`, background: 'var(--color-accent-teal)', minHeight: cloudH > 0 ? '2px' : '0' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            {[
              { label: 'Cloud Ingress', color: 'var(--color-accent-teal)' },
              { label: 'On-Prem Egress', color: 'var(--color-accent-amber)' },
              { label: 'Bidirectional', color: 'var(--color-accent-purple)' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: l.color }}></div>
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost by Pipeline Table */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Cost by Pipeline</h3>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Pipeline', 'Direction', 'Records', 'Data Transfer', 'Compute', 'Cost'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pipelineCosts.map(pc => (
                <tr key={pc.pipeline.id} className="transition-colors hover:bg-[rgba(255,255,255,0.02)]" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{pc.pipeline.name}</td>
                  <td className="px-4 py-3">
                    <span className={`badge badge-${getDirectionColor(pc.pipeline.direction)} text-[10px]`}>{getDirectionLabel(pc.pipeline.direction)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatNumber(pc.records)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatBytes(pc.bytes)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{Math.round(pc.computeMs / 3600000)}h</td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>${pc.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rate Card */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>📋 Rate Card</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { tier: 'Cloud Ingress', rate: '$0.10 / 10K rows', compute: '$0.02 / min', note: 'Standard inbound rate' },
              { tier: 'On-Prem Egress', rate: '$0.25 / 10K rows', compute: '$0.05 / min', note: 'Premium reverse sync rate' },
              { tier: 'Bidirectional', rate: '$0.30 / 10K rows', compute: '$0.06 / min', note: 'Full-duplex sync rate' },
            ].map(t => (
              <div key={t.tier} className="p-4 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t.tier}</p>
                <p className="text-lg font-bold mt-2" style={{ color: 'var(--color-accent-blue)' }}>{t.rate}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Compute: {t.compute}</p>
                <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-muted)' }}>{t.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
