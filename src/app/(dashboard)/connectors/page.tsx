'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { mockConnectors } from '@/lib/mock-data';
import { getConnectorIcon, getConnectorLabel, timeAgo } from '@/lib/utils';
import type { ConnectorCategory } from '@/types';

export default function ConnectorsPage() {
  const [filter, setFilter] = useState<ConnectorCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);

  const filtered = filter === 'all' ? mockConnectors : mockConnectors.filter(c => c.category === filter);

  const categories: { key: ConnectorCategory | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: mockConnectors.length },
    { key: 'on_prem', label: 'On-Premise', count: mockConnectors.filter(c => c.category === 'on_prem').length },
    { key: 'cloud', label: 'Cloud', count: mockConnectors.filter(c => c.category === 'cloud').length },
  ];

  return (
    <>
      <TopBar title="Connector Hub" subtitle="Manage data source and target connections" />
      <div className="p-8 space-y-6">
        {/* Filter tabs + Add button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {categories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setFilter(cat.key)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: filter === cat.key ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  color: filter === cat.key ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
                  border: `1px solid ${filter === cat.key ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-subtle)'}`,
                }}
              >
                {cat.label} <span className="ml-1 text-xs opacity-60">{cat.count}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <span>+</span> Add Connector
          </button>
        </div>

        {/* Connector Grid */}
        <div className="grid grid-cols-3 gap-4 stagger-children">
          {filtered.map(connector => (
            <div key={connector.id} className="glass-card p-5 cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                      background: connector.category === 'on_prem'
                        ? 'rgba(245, 158, 11, 0.1)' : 'rgba(20, 184, 166, 0.1)',
                      border: `1px solid ${connector.category === 'on_prem'
                        ? 'rgba(245, 158, 11, 0.2)' : 'rgba(20, 184, 166, 0.2)'}`,
                    }}>
                    {getConnectorIcon(connector.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{connector.name}</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{getConnectorLabel(connector.type)}</p>
                  </div>
                </div>
                <StatusBadge status={connector.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Host</p>
                  <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>{connector.host || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Database</p>
                  <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>{connector.database || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tables</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{connector.tables_count}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Last Access</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{timeAgo(connector.last_accessed)}</p>
                </div>
              </div>

              {/* Category badge */}
              <div className="mt-3 flex items-center justify-between">
                <span className={`badge text-[10px] ${connector.category === 'on_prem' ? 'badge-amber' : 'badge-teal'}`}>
                  {connector.category === 'on_prem' ? '🏢 On-Premise' : '☁️ Cloud'}
                </span>
                <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-accent-blue)' }}>
                  View details →
                </span>
              </div>
            </div>
          ))}

          {/* Coming Soon Cards */}
          {['Salesforce', 'HubSpot', 'Stripe'].map(name => (
            <div key={name} className="glass-card p-5 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: 'rgba(148, 163, 184, 0.05)', border: '1px solid var(--color-border-subtle)' }}>
                  {name === 'Salesforce' ? '☁️' : name === 'HubSpot' ? '🟠' : '💳'}
                </div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{name}</h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>SaaS Connector</p>
                </div>
              </div>
              <span className="badge badge-purple text-[10px]">Coming Soon</span>
            </div>
          ))}
        </div>

        {/* Add Connector Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="glass-strong rounded-2xl p-6 w-full max-w-lg animate-fade-in-scale">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Add Connector</h3>
                <button onClick={() => setShowModal(false)} className="text-lg" style={{ color: 'var(--color-text-muted)' }}>✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Name</label>
                  <input className="input-field" placeholder="My Database" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Type</label>
                  <select className="input-field" style={{ background: 'var(--color-bg-primary)' }}>
                    <option>MS SQL Server</option><option>Oracle DB</option><option>IBM DB2</option>
                    <option>PostgreSQL</option><option>MySQL</option><option>Snowflake</option>
                    <option>Databricks</option><option>Apache Iceberg</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Host</label>
                    <input className="input-field" placeholder="10.0.1.50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Port</label>
                    <input className="input-field" placeholder="1433" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Database</label>
                  <input className="input-field" placeholder="MyDatabase" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button className="btn-secondary flex-1">Test Connection</button>
                  <button className="btn-primary flex-1" onClick={() => setShowModal(false)}>Save Connector</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
