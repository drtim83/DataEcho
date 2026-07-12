'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatNumber, formatDuration, formatBytes, getConnectorIcon, getConnectorLabel, getDirectionLabel, getDirectionColor } from '@/lib/utils';

// Entirely static, hardcoded sample data — never fetched from the real API,
// never written anywhere. Safe to show to a prospect without touching real
// connectors, credentials, pipelines, or billing.

const DEMO_CONNECTORS = [
  { id: 'd1', name: 'HR SQL Server', type: 'mssql', category: 'on_prem', status: 'connected', host: '10.0.1.50', database: 'HumanResources', tables: 24 },
  { id: 'd2', name: 'Sales Postgres', type: 'postgresql', category: 'on_prem', status: 'connected', host: '10.0.2.11', database: 'SalesDB', tables: 38 },
  { id: 'd3', name: 'Analytics Warehouse', type: 'snowflake', category: 'cloud', status: 'connected', host: 'acme.snowflakecomputing.com', database: 'ANALYTICS', tables: 112 },
  { id: 'd4', name: 'Product Supabase', type: 'supabase', category: 'cloud', status: 'connected', host: 'xyzproject.supabase.co', database: 'postgres', tables: 19 },
  { id: 'd5', name: 'Finance Oracle', type: 'oracle', category: 'on_prem', status: 'error', host: '10.0.3.8', database: 'FINPROD', tables: 0 },
] as const;

// Illustrative table listing shown in the connector detail modal — simulated,
// same as the rest of this page. Keyed by connector id.
const DEMO_CONNECTOR_TABLES: Record<string, { name: string; rows: number }[]> = {
  d1: [
    { name: 'employees', rows: 1284 },
    { name: 'departments', rows: 18 },
    { name: 'payroll', rows: 15408 },
    { name: 'benefits_enrollment', rows: 1102 },
  ],
  d2: [
    { name: 'orders', rows: 452900 },
    { name: 'customers', rows: 38210 },
    { name: 'products', rows: 640 },
    { name: 'invoices', rows: 61300 },
  ],
  d3: [
    { name: 'fact_sales', rows: 12400000 },
    { name: 'dim_customer', rows: 38210 },
    { name: 'dim_product', rows: 640 },
    { name: 'agg_daily_revenue', rows: 1825 },
  ],
  d4: [
    { name: 'profiles', rows: 12840 },
    { name: 'orders', rows: 452900 },
    { name: 'inventory', rows: 9120 },
    { name: 'api_keys', rows: 42 },
  ],
  d5: [],
};

const DEMO_PIPELINES = [
  { id: 'p1', name: 'Employee 360 Sync', source: 'HR SQL Server', target: 'Analytics Warehouse', direction: 'cloud_bound', status: 'active', records: 128_400 },
  { id: 'p2', name: 'Order Reconciliation', source: 'Sales Postgres', target: 'Product Supabase', direction: 'bidirectional', status: 'active', records: 452_900 },
  { id: 'p3', name: 'Inventory Backfill', source: 'Product Supabase', target: 'Analytics Warehouse', direction: 'cloud_bound', status: 'draft', records: 0 },
  { id: 'p4', name: 'Customer Writeback', source: 'Analytics Warehouse', target: 'Sales Postgres', direction: 'on_prem_bound', status: 'active', records: 34_200 },
] as const;

const DEMO_SAMPLE_DATA = {
  employees: {
    columns: ['employee_id', 'first_name', 'last_name', 'department', 'hire_date', 'salary'],
    rows: [
      { employee_id: 1001, first_name: 'Sarah', last_name: 'Chen', department: 'Engineering', hire_date: '2022-03-15', salary: 145000 },
      { employee_id: 1002, first_name: 'Marcus', last_name: 'Williams', department: 'Sales', hire_date: '2021-11-02', salary: 98000 },
      { employee_id: 1003, first_name: 'Aisha', last_name: 'Patel', department: 'Engineering', hire_date: '2023-01-09', salary: 132000 },
      { employee_id: 1004, first_name: 'James', last_name: 'O\'Brien', department: 'Marketing', hire_date: '2020-07-22', salary: 110000 },
      { employee_id: 1005, first_name: 'Yuki', last_name: 'Tanaka', department: 'Engineering', hire_date: '2023-06-18', salary: 128000 },
    ],
  },
  orders: {
    columns: ['order_id', 'customer', 'product', 'amount', 'status', 'created_at'],
    rows: [
      { order_id: 'ORD-9841', customer: 'Acme Corp', product: 'Enterprise License', amount: '$12,500', status: 'completed', created_at: '2025-07-10' },
      { order_id: 'ORD-9842', customer: 'TechStart Inc', product: 'Pro Tier', amount: '$4,200', status: 'processing', created_at: '2025-07-11' },
      { order_id: 'ORD-9843', customer: 'Global Logistics', product: 'Data Add-on', amount: '$890', status: 'completed', created_at: '2025-07-11' },
      { order_id: 'ORD-9844', customer: 'MediHealth', product: 'Enterprise License', amount: '$15,000', status: 'pending', created_at: '2025-07-12' },
      { order_id: 'ORD-9845', customer: 'EduPlatform', product: 'Starter Tier', amount: '$1,500', status: 'completed', created_at: '2025-07-12' },
    ],
  },
  inventory: {
    columns: ['sku', 'product_name', 'warehouse', 'quantity', 'reorder_point', 'last_updated'],
    rows: [
      { sku: 'SKU-001', product_name: 'Widget A', warehouse: 'US-East', quantity: 2340, reorder_point: 500, last_updated: '2025-07-12 09:15' },
      { sku: 'SKU-002', product_name: 'Gadget Pro', warehouse: 'US-West', quantity: 812, reorder_point: 200, last_updated: '2025-07-12 09:15' },
      { sku: 'SKU-003', product_name: 'Connector XL', warehouse: 'EU-Central', quantity: 156, reorder_point: 300, last_updated: '2025-07-12 08:30' },
      { sku: 'SKU-004', product_name: 'Adapter Mini', warehouse: 'US-East', quantity: 4521, reorder_point: 1000, last_updated: '2025-07-12 09:00' },
      { sku: 'SKU-005', product_name: 'Hub Standard', warehouse: 'APAC', quantity: 89, reorder_point: 150, last_updated: '2025-07-11 23:45' },
    ],
  },
};

const DEMO_SCHEDULES = [
  { id: 's1', pipeline: 'Employee 360 Sync', cron: '0 */6 * * *', label: 'Every 6 hours', next_run: '2025-07-12 18:00 UTC', last_run: '2025-07-12 12:00 UTC', status: 'active', duration: '2m 14s' },
  { id: 's2', pipeline: 'Order Reconciliation', cron: '*/15 * * * *', label: 'Every 15 minutes', next_run: '2025-07-12 16:45 UTC', last_run: '2025-07-12 16:30 UTC', status: 'active', duration: '48s' },
  { id: 's3', pipeline: 'Customer Writeback', cron: '0 2 * * *', label: 'Daily at 2:00 AM', next_run: '2025-07-13 02:00 UTC', last_run: '2025-07-12 02:00 UTC', status: 'active', duration: '5m 32s' },
  { id: 's4', pipeline: 'Inventory Backfill', cron: '—', label: 'Not scheduled', next_run: '—', last_run: '—', status: 'draft', duration: '—' },
];

const DEMO_DAILY = [
  { date: 'Mon', cloud: 12400, onPrem: 8200, bi: 5600 },
  { date: 'Tue', cloud: 18200, onPrem: 12800, bi: 7400 },
  { date: 'Wed', cloud: 15600, onPrem: 9100, bi: 6800 },
  { date: 'Thu', cloud: 21400, onPrem: 14200, bi: 9300 },
  { date: 'Fri', cloud: 24800, onPrem: 16100, bi: 11200 },
  { date: 'Sat', cloud: 9800, onPrem: 5200, bi: 3400 },
  { date: 'Sun', cloud: 11200, onPrem: 6800, bi: 4100 },
];

const DEMO_METERING = {
  total_cost: 284.27,
  cloud_bound_cost: 141.10,
  on_prem_bound_cost: 88.55,
  bidirectional_cost: 54.62,
  total_records: 1_843_200,
  total_bytes: 4_812_000_000,
};

type Tab = 'connectors' | 'data' | 'schedule' | 'analytics' | 'metering';

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('connectors');
  const [selectedTable, setSelectedTable] = useState<keyof typeof DEMO_SAMPLE_DATA>('employees');
  const [selectedConnector, setSelectedConnector] = useState<(typeof DEMO_CONNECTORS)[number] | null>(null);

  // State for live Supabase connection test
  const [liveTestStatus, setLiveTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [liveTestMessage, setLiveTestMessage] = useState('');

  async function testLiveSupabase() {
    setLiveTestStatus('testing');
    try {
      const res = await fetch('/api/demo/test-supabase');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      setLiveTestStatus('success');
      setLiveTestMessage(data.details || data.message);
    } catch (err) {
      setLiveTestStatus('error');
      setLiveTestMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'connectors', label: 'Connectors', icon: '🔌' },
    { key: 'data', label: 'Sample Data', icon: '📋' },
    { key: 'schedule', label: 'Schedule', icon: '⏰' },
    { key: 'analytics', label: 'Analytics', icon: '📈' },
    { key: 'metering', label: 'Metering', icon: '💰' },
  ];

  const maxDaily = Math.max(...DEMO_DAILY.map((d) => d.cloud + d.onPrem + d.bi));

  return (
    <>
      <TopBar title="Demo" subtitle="Simulated data for walkthroughs and demos — no real data is touched" />
      <div className="p-8 space-y-6">
        {/* Banner */}
        <div className="p-4 rounded-xl text-xs flex items-start gap-2" style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', color: 'var(--color-accent-purple)' }}>
          <span className="text-sm mt-0.5">🎭</span>
          <span>Everything on this page is simulated data — safe to use in a walkthrough or sales demo. The one exception is the &ldquo;Test Live Connection&rdquo; button below, which does run a real read-only query against your DataEcho Supabase database to prove the connection is live.</span>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-4 stagger-children">
          <div className="glass-card p-4 text-center">
            <span className="text-xl">🔌</span>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>{DEMO_CONNECTORS.length}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Connectors</p>
          </div>
          <div className="glass-card p-4 text-center">
            <span className="text-xl">🔗</span>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>{DEMO_PIPELINES.filter((p) => p.status === 'active').length}/{DEMO_PIPELINES.length}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Active Pipelines</p>
          </div>
          <div className="glass-card p-4 text-center">
            <span className="text-xl">📊</span>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(DEMO_METERING.total_records)}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Records Synced</p>
          </div>
          <div className="glass-card p-4 text-center">
            <span className="text-xl">⚡</span>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>{formatDuration(1850)}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Avg Latency</p>
          </div>
          <div className="glass-card p-4 text-center">
            <span className="text-xl">✅</span>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>98.4%</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Success Rate</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer flex items-center gap-2"
              style={{
                background: activeTab === tab.key ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                color: activeTab === tab.key ? 'var(--color-accent-purple)' : 'var(--color-text-secondary)',
                border: `1px solid ${activeTab === tab.key ? 'rgba(139, 92, 246, 0.3)' : 'var(--color-border-subtle)'}`,
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════ CONNECTORS TAB ═══════════════════ */}
        {activeTab === 'connectors' && (
          <div className="grid grid-cols-3 gap-4 stagger-children">
            {DEMO_CONNECTORS.map((c) => (
              <div
                key={c.id}
                className="glass-card p-5 cursor-pointer transition-transform hover:scale-[1.01]"
                onClick={() => setSelectedConnector(c)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{
                        background: c.category === 'on_prem' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(20, 184, 166, 0.1)',
                        border: `1px solid ${c.category === 'on_prem' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(20, 184, 166, 0.2)'}`,
                      }}>
                      {getConnectorIcon(c.type)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{c.name}</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{getConnectorLabel(c.type)}</p>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Host</p>
                    <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>{c.host}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Database</p>
                    <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>{c.database}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tables</p>
                    <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{c.tables}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`badge text-[10px] ${c.category === 'on_prem' ? 'badge-amber' : 'badge-teal'}`}>
                    {c.category === 'on_prem' ? '🏢 On-Premise' : '☁️ Cloud'}
                  </span>
                  {c.id === 'd4' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); testLiveSupabase(); }}
                      disabled={liveTestStatus === 'testing'}
                      className="text-[10px] cursor-pointer transition-opacity hover:opacity-80"
                      style={{ color: 'var(--color-accent-blue)' }}
                    >
                      {liveTestStatus === 'testing' ? 'Testing...' : 'Test Live Connection'}
                    </button>
                  )}
                </div>
                {c.id === 'd4' && liveTestStatus !== 'idle' && (
                  <div className="mt-3 text-[10px] p-2.5 rounded-lg border" style={{
                    background: liveTestStatus === 'success' ? 'rgba(20, 184, 166, 0.05)' : liveTestStatus === 'error' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.05)',
                    borderColor: liveTestStatus === 'success' ? 'rgba(20, 184, 166, 0.2)' : liveTestStatus === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: liveTestStatus === 'success' ? 'var(--color-accent-teal)' : liveTestStatus === 'error' ? 'var(--color-accent-coral)' : 'var(--color-accent-blue)'
                  }}>
                    {liveTestStatus === 'testing' ? 'Connecting to DataEcho Supabase...' : liveTestMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Connector Detail Modal */}
        {selectedConnector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setSelectedConnector(null)}>
            <div className="glass-strong rounded-2xl p-6 w-full max-w-lg animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                      background: selectedConnector.category === 'on_prem' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(20, 184, 166, 0.1)',
                      border: `1px solid ${selectedConnector.category === 'on_prem' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(20, 184, 166, 0.2)'}`,
                    }}>
                    {getConnectorIcon(selectedConnector.type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedConnector.name}</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{getConnectorLabel(selectedConnector.type)}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedConnector(null)} className="text-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>✕</button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5 pb-5" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Status</p>
                  <div className="mt-1"><StatusBadge status={selectedConnector.status} /></div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Category</p>
                  <span className={`badge text-[10px] mt-1 ${selectedConnector.category === 'on_prem' ? 'badge-amber' : 'badge-teal'}`}>
                    {selectedConnector.category === 'on_prem' ? '🏢 On-Premise' : '☁️ Cloud'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Host</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{selectedConnector.host}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Database</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{selectedConnector.database}</p>
                </div>
              </div>

              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                {selectedConnector.status === 'error' ? '⚠️ Tables' : `📋 Tables (${selectedConnector.tables} total, showing sample)`}
              </p>
              {selectedConnector.status === 'error' ? (
                <p className="text-xs p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.06)', color: 'var(--color-accent-coral)' }}>
                  Unable to enumerate tables — connection error. Fix the connector&apos;s credentials in Connector Hub to restore schema browsing.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {(DEMO_CONNECTOR_TABLES[selectedConnector.id] || []).map((t) => (
                    <div key={t.name} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg-primary)' }}>
                      <span className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{t.name}</span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{formatNumber(t.rows)} rows</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] mt-4 italic" style={{ color: 'var(--color-text-muted)' }}>
                Simulated for this demo. Real schema browsing (all {selectedConnector.tables} tables, live column types and sample rows) is available in Connector Hub.
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════════ SAMPLE DATA TAB ═══════════════════ */}
        {activeTab === 'data' && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>📋 Sample Data Preview</h3>
              <div className="flex items-center gap-2">
                {(Object.keys(DEMO_SAMPLE_DATA) as (keyof typeof DEMO_SAMPLE_DATA)[]).map((table) => (
                  <button
                    key={table}
                    onClick={() => setSelectedTable(table)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                    style={{
                      background: selectedTable === table ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      color: selectedTable === table ? 'var(--color-accent-blue)' : 'var(--color-text-muted)',
                      border: `1px solid ${selectedTable === table ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-subtle)'}`,
                    }}
                  >
                    {table}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex items-center gap-4">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {DEMO_SAMPLE_DATA[selectedTable].rows.length} rows · {DEMO_SAMPLE_DATA[selectedTable].columns.length} columns
              </span>
              <span className="badge badge-blue text-[10px]">Simulated</span>
            </div>

            <div className="overflow-auto rounded-xl" style={{ border: '1px solid var(--color-border-subtle)' }}>
              <table className="w-full">
                <thead style={{ background: 'var(--color-bg-elevated)' }}>
                  <tr>
                    {DEMO_SAMPLE_DATA[selectedTable].columns.map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO_SAMPLE_DATA[selectedTable].rows.map((row, i) => (
                    <tr key={i} className="table-row" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                      {DEMO_SAMPLE_DATA[selectedTable].columns.map((col) => (
                        <td key={col} className="px-4 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                          {String((row as Record<string, unknown>)[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════ SCHEDULE TAB ═══════════════════ */}
        {activeTab === 'schedule' && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>⏰ Pipeline Schedules</h3>
            <div className="overflow-auto rounded-xl" style={{ border: '1px solid var(--color-border-subtle)' }}>
              <table className="w-full">
                <thead style={{ background: 'var(--color-bg-elevated)' }}>
                  <tr>
                    {['Pipeline', 'Schedule', 'Cron', 'Last Run', 'Duration', 'Next Run', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO_SCHEDULES.map((s) => (
                    <tr key={s.id} className="table-row" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.pipeline}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-accent-blue)' }}>{s.cron}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.last_run}</td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.duration}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.next_run}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Timeline visualization */}
            <div className="mt-6">
              <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>24-Hour Timeline</h4>
              <div className="relative rounded-xl p-4" style={{ background: 'var(--color-bg-primary)' }}>
                {/* Hour markers */}
                <div className="flex items-center justify-between mb-3">
                  {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
                    <span key={h} className="text-[9px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{String(h).padStart(2, '0')}:00</span>
                  ))}
                </div>
                {/* Bars */}
                {DEMO_SCHEDULES.filter((s) => s.status === 'active').map((s, i) => {
                  const colors = ['var(--color-accent-teal)', 'var(--color-accent-blue)', 'var(--color-accent-purple)'];
                  const intervals = s.cron === '*/15 * * * *' ? 96 : s.cron === '0 */6 * * *' ? 4 : 1;
                  return (
                    <div key={s.id} className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-medium w-40 truncate" style={{ color: 'var(--color-text-secondary)' }}>{s.pipeline}</span>
                        <div className="flex-1 h-4 rounded-full relative" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          {Array.from({ length: Math.min(intervals, 24) }, (_, j) => (
                            <div
                              key={j}
                              className="absolute h-full rounded-full"
                              style={{
                                left: `${(j / Math.max(intervals, 1)) * 100}%`,
                                width: `${Math.max(100 / intervals * 0.6, 0.5)}%`,
                                background: colors[i % colors.length],
                                opacity: 0.7,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ ANALYTICS TAB ═══════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Volume by day chart */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Weekly Volume by Direction</h3>
                <div className="flex items-end gap-2" style={{ height: '200px' }}>
                  {DEMO_DAILY.map((d) => {
                    const total = d.cloud + d.onPrem + d.bi;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${d.date}: ${formatNumber(total)} records`}>
                        <div className="w-full flex flex-col">
                          <div className="w-full rounded-t-sm" style={{ height: `${(d.bi / maxDaily) * 100}%`, background: 'var(--color-accent-purple)', minHeight: d.bi > 0 ? '2px' : '0' }} />
                          <div className="w-full" style={{ height: `${(d.onPrem / maxDaily) * 100}%`, background: 'var(--color-accent-amber)', minHeight: d.onPrem > 0 ? '2px' : '0' }} />
                          <div className="w-full rounded-b-sm" style={{ height: `${(d.cloud / maxDaily) * 100}%`, background: 'var(--color-accent-teal)', minHeight: d.cloud > 0 ? '2px' : '0' }} />
                        </div>
                        <span className="text-[9px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{d.date}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-6 mt-4">
                  {[
                    { label: 'Cloud Ingress', color: 'var(--color-accent-teal)' },
                    { label: 'On-Prem Egress', color: 'var(--color-accent-amber)' },
                    { label: 'Bidirectional', color: 'var(--color-accent-purple)' },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pipeline performance */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Pipeline Performance</h3>
                <div className="space-y-4">
                  {DEMO_PIPELINES.filter((p) => p.status === 'active').map((p) => {
                    const pct = Math.round((p.records / DEMO_METERING.total_records) * 100);
                    return (
                      <div key={p.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{p.name}</span>
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatNumber(p.records)} records</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full rounded-full transition-all duration-1000" style={{
                            width: `${pct}%`,
                            background: p.direction === 'cloud_bound' ? 'var(--color-accent-teal)' : p.direction === 'on_prem_bound' ? 'var(--color-accent-amber)' : 'var(--color-accent-purple)',
                          }} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge badge-${getDirectionColor(p.direction)} text-[9px]`}>{getDirectionLabel(p.direction)}</span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{pct}% of total</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="glass-card p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total Records</p>
                <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{formatNumber(DEMO_METERING.total_records)}</p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Data Transferred</p>
                <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{formatBytes(DEMO_METERING.total_bytes)}</p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Avg Latency</p>
                <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{formatDuration(1850)}</p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Uptime</p>
                <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-accent-teal)' }}>99.97%</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ METERING TAB ═══════════════════ */}
        {activeTab === 'metering' && (
          <div className="space-y-4">
            {/* Cost summary */}
            <div className="grid grid-cols-4 gap-4 stagger-children">
              <div className="glass-card p-5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total Cost (Month)</p>
                <p className="text-3xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>${DEMO_METERING.total_cost.toFixed(2)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{formatNumber(DEMO_METERING.total_records)} records · {formatBytes(DEMO_METERING.total_bytes)}</p>
              </div>
              <div className="glass-card p-5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Cloud Ingress</p>
                <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-accent-teal)' }}>${DEMO_METERING.cloud_bound_cost.toFixed(2)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{Math.round((DEMO_METERING.cloud_bound_cost / DEMO_METERING.total_cost) * 100)}% of total</p>
              </div>
              <div className="glass-card p-5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>On-Prem Egress</p>
                <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-accent-amber)' }}>${DEMO_METERING.on_prem_bound_cost.toFixed(2)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{Math.round((DEMO_METERING.on_prem_bound_cost / DEMO_METERING.total_cost) * 100)}% of total</p>
              </div>
              <div className="glass-card p-5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Bidirectional</p>
                <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-accent-purple)' }}>${DEMO_METERING.bidirectional_cost.toFixed(2)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{Math.round((DEMO_METERING.bidirectional_cost / DEMO_METERING.total_cost) * 100)}% of total</p>
              </div>
            </div>

            {/* Cost by pipeline */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Cost by Pipeline</h3>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {['Pipeline', 'Direction', 'Records', 'Data Transfer', 'Cost'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO_PIPELINES.filter((p) => p.status === 'active').map((p) => {
                    const cost = p.direction === 'cloud_bound' ? 47.03 : p.direction === 'on_prem_bound' ? 88.55 : 54.62;
                    const bytes = p.direction === 'cloud_bound' ? 1_204_000_000 : p.direction === 'on_prem_bound' ? 892_000_000 : 2_716_000_000;
                    return (
                      <tr key={p.id} className="table-row" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{p.name}</td>
                        <td className="px-4 py-3">
                          <span className={`badge badge-${getDirectionColor(p.direction)} text-[10px]`}>{getDirectionLabel(p.direction)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatNumber(p.records)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatBytes(bytes)}</td>
                        <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>${cost.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Simulated payment method */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>💳 Payment Method</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>VISA •••• 4242 — expires 12/2028</p>
                </div>
                <span className="badge badge-teal text-[10px]">Active</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
