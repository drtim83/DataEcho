'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import type { Pipeline, SchemaMapping } from '@/types';

function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    int: 'blue', numeric: 'blue', decimal: 'blue', double: 'blue', float: 'blue', bigint: 'blue', smallint: 'blue',
    nvarchar: 'teal', varchar: 'teal', text: 'teal', string: 'teal', char: 'teal', clob: 'teal',
    datetime: 'purple', timestamp: 'purple', date: 'purple', time: 'purple',
    bool: 'amber', boolean: 'amber',
  };
  const baseType = type.split('(')[0].toLowerCase();
  const color = colorMap[baseType] || 'blue';
  return <span className={`badge badge-${color} text-[10px] font-mono`}>{type}</span>;
}

export default function SchemaPage() {
  const [pipelines, setPipelines] = useState<(Pipeline & { source_table?: string; target_table?: string })[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [mappings, setMappings] = useState<SchemaMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);
  const [error, setError] = useState('');

  const pipeline = pipelines.find((p) => p.id === selectedId);

  async function loadPipelines() {
    setLoading(true);
    try {
      const res = await fetch('/api/pipelines');
      const data = await res.json();
      setPipelines(data.pipelines || []);
      if (data.pipelines?.length > 0) setSelectedId(data.pipelines[0].id);
    } finally {
      setLoading(false);
    }
  }

  async function loadMappings(pipelineId: string) {
    if (!pipelineId) { setMappings([]); return; }
    const res = await fetch(`/api/schema/map?pipeline_id=${pipelineId}`);
    const data = await res.json();
    setMappings(data.mappings || []);
  }

  useEffect(() => { loadPipelines(); }, []);
  useEffect(() => { loadMappings(selectedId); }, [selectedId]);

  async function handleMap() {
    if (!selectedId) return;
    setMapping(true);
    setError('');
    try {
      const res = await fetch('/api/schema/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mapping failed');
      setMappings(data.mappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mapping failed');
    } finally {
      setMapping(false);
    }
  }

  const avgConfidence = mappings.length > 0 ? Math.round((mappings.reduce((sum, m) => sum + m.ai_confidence, 0) / mappings.length) * 100) : 0;

  return (
    <>
      <TopBar title="Schema Mapping" subtitle="Heuristic column mapping with type-compatibility checks" />
      <div className="p-8 space-y-6">
        {/* Pipeline selector */}
        <div className="flex items-center gap-4">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Pipeline</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="input-field w-auto"
            style={{ background: 'var(--color-bg-surface)' }}
          >
            {pipelines.length === 0 && <option value="">No pipelines yet</option>}
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <span className="badge badge-purple text-xs">🧠 Heuristic name + type matching</span>
            <button className="btn-primary text-xs disabled:opacity-50" onClick={handleMap} disabled={!selectedId || mapping}>
              {mapping ? 'Mapping…' : 'Compute Mapping'}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm py-2 px-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>{error}</div>
        )}

        {!loading && pipelines.length === 0 && (
          <div className="glass-card p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No pipelines yet. Create one on the Pipeline Canvas page first.
          </div>
        )}

        {pipeline && (
          <>
            {/* Schema Mapper */}
            <div className="glass-card p-6">
              <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-4 items-center mb-4 pb-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🗄️</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-accent-amber)' }}>Source</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{pipeline.source_connector?.name} · {pipeline.source_table}</p>
                  </div>
                </div>
                <span className="text-lg" style={{ color: 'var(--color-text-muted)' }}>→</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg">☁️</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-accent-teal)' }}>Target</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{pipeline.target_connector?.name} · {pipeline.target_table}</p>
                  </div>
                </div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Confidence</p>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }} />
              </div>

              {mappings.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                  No mapping yet — click &ldquo;Compute Mapping&rdquo; to introspect both tables and generate one.
                </p>
              ) : (
                <div className="space-y-2">
                  {mappings.map((m) => (
                    <div key={m.id || `${m.source_col}-${m.target_col}`}>
                      <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-4 items-center py-3 px-3 rounded-xl transition-colors hover:bg-[var(--color-bg-primary)]">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-amber)' }}></div>
                          <div>
                            <p className="text-sm font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>{m.source_col}</p>
                            <TypeBadge type={m.source_type} />
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div className="w-12 h-[2px] relative" style={{ background: 'linear-gradient(90deg, var(--color-accent-amber), var(--color-accent-teal))' }}>
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
                              style={{ borderLeft: '6px solid var(--color-accent-teal)', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }}></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-teal)' }}></div>
                          <div>
                            <p className="text-sm font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>{m.target_col}</p>
                            <TypeBadge type={m.target_type} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
                            <div className="h-full rounded-full" style={{
                              width: `${m.ai_confidence * 100}%`,
                              background: m.ai_confidence >= 0.9 ? 'var(--color-accent-teal)' : m.ai_confidence >= 0.7 ? 'var(--color-accent-amber)' : 'var(--color-accent-coral)',
                            }}></div>
                          </div>
                          <span className="text-xs font-medium" style={{
                            color: m.ai_confidence >= 0.9 ? 'var(--color-accent-teal)' : m.ai_confidence >= 0.7 ? 'var(--color-accent-amber)' : 'var(--color-accent-coral)',
                          }}>
                            {Math.round(m.ai_confidence * 100)}%
                          </span>
                        </div>
                        <div />
                      </div>
                      {m.ai_warning && (
                        <div className="ml-8 mt-1 mb-2 flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                          <span className="text-sm mt-0.5">🧠</span>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-accent-purple)' }}>{m.ai_warning}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {mappings.length > 0 && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🧠</span>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-accent-purple)' }}>Mapping Summary</h3>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{mappings.length}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Total Mappings</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-accent-teal)' }}>{avgConfidence}%</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Avg Confidence</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-accent-amber)' }}>{mappings.filter((m) => m.ai_warning).length}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Warnings</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-accent-teal)' }}>{mappings.filter((m) => m.ai_confidence >= 0.9).length}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>High Confidence</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
