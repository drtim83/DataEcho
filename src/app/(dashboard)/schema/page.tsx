'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { mockSchemaMappings, mockPipelines } from '@/lib/mock-data';

function TypeBadge({ type, side }: { type: string; side: 'source' | 'target' }) {
  const colorMap: Record<string, string> = {
    INT: 'blue', NUMBER: 'blue', DECIMAL: 'blue', DOUBLE: 'blue', FLOAT: 'blue',
    NVARCHAR: 'teal', VARCHAR: 'teal', STRING: 'teal', CHAR: 'teal', CLOB: 'teal',
    DATETIME: 'purple', TIMESTAMP_NTZ: 'purple', TIMESTAMP: 'purple',
    ARRAY: 'amber',
  };
  const baseType = type.split('(')[0].split('<')[0];
  const color = colorMap[baseType] || 'blue';
  return (
    <span className={`badge badge-${color} text-[10px] font-mono`}>{type}</span>
  );
}

export default function SchemaPage() {
  const [selectedPipeline, setSelectedPipeline] = useState('pipe-1');
  const mappings = mockSchemaMappings.filter(m => m.pipeline_id === selectedPipeline);
  const pipeline = mockPipelines.find(p => p.id === selectedPipeline);

  return (
    <>
      <TopBar title="AI Schema Mapping" subtitle="Intelligent column mapping with type recommendations" />
      <div className="p-8 space-y-6">
        {/* Pipeline selector */}
        <div className="flex items-center gap-4">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Pipeline</label>
          <select
            value={selectedPipeline}
            onChange={(e) => setSelectedPipeline(e.target.value)}
            className="input-field w-auto"
            style={{ background: 'var(--color-bg-surface)' }}
          >
            {mockPipelines.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <span className="badge badge-purple text-xs">🧠 AI-Assisted</span>
            <button className="btn-primary text-xs">Apply All Mappings</button>
          </div>
        </div>

        {/* Schema Mapper */}
        <div className="glass-card p-6">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-4 items-center mb-4 pb-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{pipeline?.source_connector ? '🗄️' : '📦'}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-accent-amber)' }}>Source</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{pipeline?.source_connector?.name}</p>
              </div>
            </div>
            <span className="text-lg" style={{ color: 'var(--color-text-muted)' }}>→</span>
            <div className="flex items-center gap-2">
              <span className="text-lg">❄️</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-accent-teal)' }}>Target</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{pipeline?.target_connector?.name}</p>
              </div>
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Confidence</p>
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Action</p>
          </div>

          {/* Mapping Rows */}
          <div className="space-y-2">
            {mappings.map((mapping) => (
              <div key={mapping.id}>
                <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-4 items-center py-3 px-3 rounded-xl transition-colors hover:bg-[var(--color-bg-primary)]">
                  {/* Source Column */}
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-amber)' }}></div>
                    <div>
                      <p className="text-sm font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>{mapping.source_col}</p>
                      <TypeBadge type={mapping.source_type} side="source" />
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center">
                    <div className="w-12 h-[2px] relative" style={{ background: `linear-gradient(90deg, var(--color-accent-amber), var(--color-accent-teal))` }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
                        style={{ borderLeft: '6px solid var(--color-accent-teal)', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }}></div>
                    </div>
                  </div>

                  {/* Target Column */}
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-teal)' }}></div>
                    <div>
                      <p className="text-sm font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>{mapping.target_col}</p>
                      <TypeBadge type={mapping.target_type} side="target" />
                    </div>
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${mapping.ai_confidence * 100}%`,
                        background: mapping.ai_confidence >= 0.9 ? 'var(--color-accent-teal)' :
                          mapping.ai_confidence >= 0.7 ? 'var(--color-accent-amber)' : 'var(--color-accent-coral)',
                      }}></div>
                    </div>
                    <span className="text-xs font-medium" style={{
                      color: mapping.ai_confidence >= 0.9 ? 'var(--color-accent-teal)' :
                        mapping.ai_confidence >= 0.7 ? 'var(--color-accent-amber)' : 'var(--color-accent-coral)',
                    }}>
                      {Math.round(mapping.ai_confidence * 100)}%
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors" style={{ background: 'rgba(20, 184, 166, 0.1)', color: 'var(--color-accent-teal)' }}>✓</button>
                    <button className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-accent-blue)' }}>✏️</button>
                    <button className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>✕</button>
                  </div>
                </div>

                {/* AI Warning */}
                {mapping.ai_warning && (
                  <div className="ml-8 mt-1 mb-2 flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                    <span className="text-sm mt-0.5">🧠</span>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-accent-purple)' }}>{mapping.ai_warning}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Summary */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🧠</span>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-accent-purple)' }}>AI Mapping Summary</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
              <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{mappings.length}</p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Total Mappings</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
              <p className="text-xl font-bold" style={{ color: 'var(--color-accent-teal)' }}>
                {Math.round(mappings.reduce((sum, m) => sum + m.ai_confidence, 0) / mappings.length * 100)}%
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Avg Confidence</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
              <p className="text-xl font-bold" style={{ color: 'var(--color-accent-amber)' }}>
                {mappings.filter(m => m.ai_warning).length}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Warnings</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
              <p className="text-xl font-bold" style={{ color: 'var(--color-accent-teal)' }}>
                {mappings.filter(m => m.ai_confidence >= 0.9).length}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>High Confidence</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
