'use client';

import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatNumber, formatDuration, getConnectorIcon, getConnectorLabel, getDirectionLabel, getDirectionColor } from '@/lib/utils';

// Entirely static, hardcoded sample data — never fetched from the real API,
// never written anywhere. Safe to show to a prospect without touching real
// connectors, credentials, pipelines, or billing.

const DEMO_CONNECTORS = [
  { id: 'd1', name: 'HR SQL Server', type: 'mssql', category: 'on_prem', status: 'connected' },
  { id: 'd2', name: 'Sales Postgres', type: 'postgresql', category: 'on_prem', status: 'connected' },
  { id: 'd3', name: 'Analytics Warehouse', type: 'snowflake', category: 'cloud', status: 'connected' },
  { id: 'd4', name: 'Product Supabase', type: 'supabase', category: 'cloud', status: 'connected' },
] as const;

const DEMO_PIPELINES = [
  { id: 'p1', name: 'Employee 360 Sync', source: 'HR SQL Server', target: 'Analytics Warehouse', direction: 'cloud_bound', status: 'active', records: 128_400 },
  { id: 'p2', name: 'Order Reconciliation', source: 'Sales Postgres', target: 'Product Supabase', direction: 'bidirectional', status: 'active', records: 452_900 },
  { id: 'p3', name: 'Inventory Backfill', source: 'Product Supabase', target: 'Analytics Warehouse', direction: 'cloud_bound', status: 'draft', records: 0 },
] as const;

const DEMO_DAILY = [
  { date: 'Mon', records: 42000 }, { date: 'Tue', records: 58000 }, { date: 'Wed', records: 51000 },
  { date: 'Thu', records: 67000 }, { date: 'Fri', records: 74000 }, { date: 'Sat', records: 39000 }, { date: 'Sun', records: 45000 },
] as const;

const DEMO_METERING = {
  total_cost: 84.27,
  cloud_bound_cost: 41.10,
  on_prem_bound_cost: 28.55,
  bidirectional_cost: 14.62,
};

export default function DemoPage() {
  const maxRecords = Math.max(...DEMO_DAILY.map((d) => d.records));

  return (
    <>
      <TopBar title="Demo" subtitle="Simulated data for walkthroughs and demos" />
      <div className="p-8 space-y-6">
        <div className="p-4 rounded-xl text-xs flex items-start gap-2" style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', color: 'var(--color-accent-purple)' }}>
          <span className="text-sm mt-0.5">🎭</span>
          <span>Everything on this page is simulated. It never reads from or writes to your real connectors, pipelines, credentials, or billing — safe to use in a walkthrough or sales demo.</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-5">
            <span className="text-2xl">🔗</span>
            <p className="text-2xl font-bold mt-3" style={{ color: 'var(--color-text-primary)' }}>2/3</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Active Pipelines</p>
          </div>
          <div className="glass-card p-5">
            <span className="text-2xl">📊</span>
            <p className="text-2xl font-bold mt-3" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(581_300)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Records Synced (24h)</p>
          </div>
          <div className="glass-card p-5">
            <span className="text-2xl">⚡</span>
            <p className="text-2xl font-bold mt-3" style={{ color: 'var(--color-text-primary)' }}>{formatDuration(1850)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Avg Latency</p>
          </div>
          <div className="glass-card p-5">
            <span className="text-2xl">✅</span>
            <p className="text-2xl font-bold mt-3" style={{ color: 'var(--color-text-primary)' }}>98.4%</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Success Rate</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Connectors */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Connectors</h3>
            <div className="space-y-2">
              {DEMO_CONNECTORS.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getConnectorIcon(c.type)}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{c.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{getConnectorLabel(c.type)}</p>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Pipelines */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Pipelines</h3>
            <div className="space-y-2">
              {DEMO_PIPELINES.map((p) => (
                <div key={p.id} className="py-2 px-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{p.name}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge badge-${getDirectionColor(p.direction)} text-[10px]`}>{getDirectionLabel(p.direction)}</span>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{p.source} → {p.target} · {formatNumber(p.records)} records</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Analytics */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Weekly Volume</h3>
            <div className="flex items-end gap-2" style={{ height: '160px' }}>
              {DEMO_DAILY.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="w-full rounded-t-sm" style={{
                    height: `${(d.records / maxRecords) * 100}%`,
                    background: 'linear-gradient(to top, var(--color-accent-blue), var(--color-accent-teal))',
                    minHeight: '4px',
                  }} />
                  <span className="text-[9px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{d.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metering */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Estimated Monthly Cost</h3>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>${DEMO_METERING.total_cost.toFixed(2)}</p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>↑ Cloud Ingress</span>
                <span className="text-xs font-medium" style={{ color: 'var(--color-accent-teal)' }}>${DEMO_METERING.cloud_bound_cost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>↓ On-Prem Egress</span>
                <span className="text-xs font-medium" style={{ color: 'var(--color-accent-amber)' }}>${DEMO_METERING.on_prem_bound_cost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>↕ Bidirectional</span>
                <span className="text-xs font-medium" style={{ color: 'var(--color-accent-purple)' }}>${DEMO_METERING.bidirectional_cost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
