'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { getConnectorIcon, getConnectorLabel, timeAgo } from '@/lib/utils';
import type { Connector, ConnectorCategory, ConnectorType } from '@/types';

const CONNECTOR_TYPES: { value: ConnectorType; label: string; category: ConnectorCategory }[] = [
  { value: 'mssql', label: 'MS SQL Server', category: 'on_prem' },
  { value: 'oracle', label: 'Oracle DB', category: 'on_prem' },
  { value: 'db2', label: 'IBM DB2', category: 'on_prem' },
  { value: 'postgresql', label: 'PostgreSQL', category: 'on_prem' },
  { value: 'mysql', label: 'MySQL', category: 'on_prem' },
  { value: 'supabase', label: 'Supabase', category: 'cloud' },
  { value: 'snowflake', label: 'Snowflake', category: 'cloud' },
  { value: 'databricks', label: 'Databricks', category: 'cloud' },
  { value: 'iceberg', label: 'Apache Iceberg', category: 'cloud' },
];

const DEFAULT_PORTS: Partial<Record<ConnectorType, number>> = {
  mssql: 1433,
  postgresql: 5432,
  mysql: 3306,
  oracle: 1521,
  db2: 50000,
  supabase: 5432,
};

interface FormState {
  name: string;
  type: ConnectorType;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

const emptyForm: FormState = {
  name: '',
  type: 'mssql',
  host: '',
  port: String(DEFAULT_PORTS.mssql),
  database: '',
  username: '',
  password: '',
};

export default function ConnectorsPage() {
  const [filter, setFilter] = useState<ConnectorCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [testState, setTestState] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [saving, setSaving] = useState(false);
  const [retestingId, setRetestingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [previewConnector, setPreviewConnector] = useState<Connector | null>(null);
  const [previewTables, setPreviewTables] = useState<string[]>([]);
  const [previewTable, setPreviewTable] = useState('');
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  async function loadConnectors() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/connectors');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load connectors');
      setConnectors(data.connectors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connectors');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConnectors();
    fetch('/api/profile').then((r) => r.json()).then((data) => setIsAdmin(data.profile?.role === 'admin'));
  }, []);

  const filtered = filter === 'all' ? connectors : connectors.filter(c => c.category === filter);

  const categories: { key: ConnectorCategory | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: connectors.length },
    { key: 'on_prem', label: 'On-Premise', count: connectors.filter(c => c.category === 'on_prem').length },
    { key: 'cloud', label: 'Cloud', count: connectors.filter(c => c.category === 'cloud').length },
  ];

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'type') {
        const defaultPort = DEFAULT_PORTS[value as ConnectorType];
        if (defaultPort) next.port = String(defaultPort);
      }
      return next;
    });
    setTestState({ status: 'idle', message: '' });
  }

  function closeModal() {
    setShowModal(false);
    setForm(emptyForm);
    setTestState({ status: 'idle', message: '' });
  }

  async function handleTest() {
    setTestState({ status: 'testing', message: '' });
    try {
      const res = await fetch('/api/connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          host: form.host,
          port: form.port,
          database: form.database,
          username: form.username,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed');
      setTestState({ status: data.success ? 'success' : 'error', message: data.message });
    } catch (err) {
      setTestState({ status: 'error', message: err instanceof Error ? err.message : 'Test failed' });
    }
  }

  async function handleSave() {
    if (!form.name || !form.host || !form.database) {
      setTestState({ status: 'error', message: 'Name, host, and database are required.' });
      return;
    }
    setSaving(true);
    try {
      const category = CONNECTOR_TYPES.find(t => t.value === form.type)?.category || 'on_prem';
      const status = testState.status === 'success' ? 'connected' : testState.status === 'error' ? 'error' : 'configuring';
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, category, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save connector');
      setConnectors(prev => [data.connector, ...prev]);
      closeModal();
    } catch (err) {
      setTestState({ status: 'error', message: err instanceof Error ? err.message : 'Failed to save connector' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setConnectors(prev => prev.filter(c => c.id !== id));
    try {
      const res = await fetch(`/api/connectors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    } catch {
      loadConnectors();
    }
  }

  async function handleRetest(id: string) {
    setRetestingId(id);
    try {
      const res = await fetch(`/api/connectors/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.status) {
        setConnectors(prev => prev.map(c => c.id === id ? { ...c, status: data.status, last_accessed: new Date().toISOString() } : c));
      }
    } finally {
      setRetestingId(null);
    }
  }

  async function openPreview(connector: Connector) {
    setPreviewConnector(connector);
    setPreviewTable('');
    setPreviewData(null);
    setPreviewError('');
    try {
      const res = await fetch(`/api/schema/tables?connector_id=${connector.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to list tables');
      setPreviewTables(data.tables || []);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to list tables');
    }
  }

  async function loadPreviewTable(table: string) {
    if (!previewConnector) return;
    setPreviewTable(table);
    setPreviewData(null);
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/schema/preview?connector_id=${previewConnector.id}&table=${encodeURIComponent(table)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load preview');
      setPreviewData(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewConnector(null);
    setPreviewTables([]);
    setPreviewTable('');
    setPreviewData(null);
    setPreviewError('');
  }

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
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer"
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
          {isAdmin && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 cursor-pointer">
              <span>+</span> Add Connector
            </button>
          )}
        </div>

        {!loading && !isAdmin && (
          <div className="text-xs py-2 px-4 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.06)', color: 'var(--color-accent-blue)' }}>
            You can view connectors, but only admins can add, test, or delete them.
          </div>
        )}

        {error && (
          <div className="text-sm py-2 px-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading connectors…</div>
        ) : (
          <div className="grid grid-cols-3 gap-4 stagger-children">
            {filtered.map(connector => (
              <div key={connector.id} className="glass-card p-5 group relative">
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

                {/* Category badge + actions */}
                <div className="mt-3 flex items-center justify-between">
                  <span className={`badge text-[10px] ${connector.category === 'on_prem' ? 'badge-amber' : 'badge-teal'}`}>
                    {connector.category === 'on_prem' ? '🏢 On-Premise' : '☁️ Cloud'}
                  </span>
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openPreview(connector)}
                      className="text-[10px] cursor-pointer"
                      style={{ color: 'var(--color-accent-teal)' }}
                    >
                      Preview
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleRetest(connector.id)}
                          disabled={retestingId === connector.id}
                          className="text-[10px] cursor-pointer disabled:opacity-50"
                          style={{ color: 'var(--color-accent-blue)' }}
                        >
                          {retestingId === connector.id ? 'Testing…' : 'Test'}
                        </button>
                        <button
                          onClick={() => handleDelete(connector.id)}
                          className="text-[10px] cursor-pointer"
                          style={{ color: 'var(--color-accent-coral)' }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {!loading && filtered.length === 0 && (
              <div className="col-span-3 glass-card p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                No connectors yet. Click &ldquo;Add Connector&rdquo; to connect a real database.
              </div>
            )}

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
        )}

        {/* Add Connector Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="glass-strong rounded-2xl p-6 w-full max-w-lg animate-fade-in-scale">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Add Connector</h3>
                <button onClick={closeModal} className="text-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Name</label>
                  <input
                    className="input-field"
                    placeholder="My Database"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Type</label>
                  <select
                    className="input-field"
                    style={{ background: 'var(--color-bg-primary)' }}
                    value={form.type}
                    onChange={(e) => updateForm('type', e.target.value as ConnectorType)}
                  >
                    {CONNECTOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Host</label>
                    <input
                      className="input-field"
                      placeholder="10.0.1.50"
                      value={form.host}
                      onChange={(e) => updateForm('host', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Port</label>
                    <input
                      className="input-field"
                      placeholder="1433"
                      value={form.port}
                      onChange={(e) => updateForm('port', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Database</label>
                  <input
                    className="input-field"
                    placeholder="MyDatabase"
                    value={form.database}
                    onChange={(e) => updateForm('database', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Username</label>
                    <input
                      className="input-field"
                      placeholder="sa"
                      value={form.username}
                      onChange={(e) => updateForm('username', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Password</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => updateForm('password', e.target.value)}
                    />
                  </div>
                </div>

                {testState.status !== 'idle' && (
                  <div
                    className="text-xs py-2 px-4 rounded-lg"
                    style={{
                      background: testState.status === 'success' ? 'rgba(20, 184, 166, 0.1)' : testState.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      color: testState.status === 'success' ? 'var(--color-accent-teal)' : testState.status === 'error' ? 'var(--color-accent-coral)' : 'var(--color-accent-blue)',
                    }}
                  >
                    {testState.status === 'testing' ? 'Testing connection…' : testState.message}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    className="btn-secondary flex-1 cursor-pointer disabled:opacity-50"
                    onClick={handleTest}
                    disabled={testState.status === 'testing' || !form.host || !form.database}
                  >
                    {testState.status === 'testing' ? 'Testing…' : 'Test Connection'}
                  </button>
                  <button
                    className="btn-primary flex-1 cursor-pointer disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Connector'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewConnector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="glass-strong rounded-2xl p-6 w-full max-w-3xl animate-fade-in-scale">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{previewConnector.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Table structure &amp; data preview</p>
                </div>
                <button onClick={closePreview} className="text-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>✕</button>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Table</label>
                <select
                  className="input-field"
                  style={{ background: 'var(--color-bg-primary)' }}
                  value={previewTable}
                  onChange={(e) => loadPreviewTable(e.target.value)}
                  disabled={previewTables.length === 0}
                >
                  <option value="">{previewTables.length === 0 ? 'No tables found' : 'Select a table…'}</option>
                  {previewTables.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {previewError && (
                <div className="text-sm py-2 px-4 rounded-lg mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>
                  {previewError}
                </div>
              )}

              {previewLoading ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Loading preview…</p>
              ) : previewData ? (
                <div className="overflow-auto rounded-xl" style={{ maxHeight: '400px', border: '1px solid var(--color-border-subtle)' }}>
                  <table className="w-full">
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--color-bg-elevated)' }}>
                      <tr>
                        {previewData.columns.map((c) => (
                          <th key={c} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                          {previewData.columns.map((c) => (
                            <td key={c} className="px-3 py-2 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                              {row[c] === null || row[c] === undefined ? <span style={{ color: 'var(--color-text-muted)' }}>null</span> : String(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {previewData.rows.length === 0 && (
                        <tr><td colSpan={previewData.columns.length || 1} className="px-3 py-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>Table is empty.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Select a table to preview its structure and first 25 rows.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
