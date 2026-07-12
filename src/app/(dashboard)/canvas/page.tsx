'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import TopBar from '@/components/layout/TopBar';
import { getConnectorIcon, getConnectorLabel } from '@/lib/utils';
import type { Connector, Pipeline, PipelineDirection } from '@/types';

// ============================================================
// Custom Node Components
// ============================================================

function SourceNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[180px]" style={{
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      backdropFilter: 'blur(8px)',
    }}>
      <Handle type="source" position={Position.Right} />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{getConnectorIcon(data.connectorType as string)}</span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-accent-amber)' }}>SOURCE</span>
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{data.label as string}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{getConnectorLabel(data.connectorType as string)}</p>
    </div>
  );
}

function TargetNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[180px]" style={{
      background: 'rgba(20, 184, 166, 0.08)',
      border: '1px solid rgba(20, 184, 166, 0.3)',
      backdropFilter: 'blur(8px)',
    }}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{getConnectorIcon(data.connectorType as string)}</span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(20, 184, 166, 0.15)', color: 'var(--color-accent-teal)' }}>TARGET</span>
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{data.label as string}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{getConnectorLabel(data.connectorType as string)}</p>
    </div>
  );
}

function TransformNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[160px]" style={{
      background: 'rgba(139, 92, 246, 0.08)',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      backdropFilter: 'blur(8px)',
    }}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">⚙️</span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--color-accent-purple)' }}>TRANSFORM</span>
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{data.label as string}</p>
      <p className="text-[9px] mt-1 italic" style={{ color: 'var(--color-text-muted)' }}>Visual only — not executed by Run yet</p>
    </div>
  );
}

function FilterNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl min-w-[160px]" style={{
      background: 'rgba(59, 130, 246, 0.08)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      backdropFilter: 'blur(8px)',
    }}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🔍</span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-accent-blue)' }}>FILTER</span>
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{data.label as string}</p>
      <p className="text-[9px] mt-1 italic" style={{ color: 'var(--color-text-muted)' }}>Visual only — not executed by Run yet</p>
    </div>
  );
}

const nodeTypes = {
  source: SourceNodeComponent,
  target: TargetNodeComponent,
  transform: TransformNodeComponent,
  filter: FilterNodeComponent,
};

const paletteItems = [
  { type: 'transform', label: 'Transform', icon: '⚙️', color: 'purple' },
  { type: 'filter', label: 'Filter', icon: '🔍', color: 'blue' },
];

const edgeStyle = { stroke: 'var(--color-accent-blue)', strokeWidth: 2, strokeDasharray: '6 3' };

function defaultCanvas(pipeline: Pipeline & { source_table?: string; target_table?: string }): { nodes: Node[]; edges: Edge[] } {
  const sourceId = `source-${pipeline.id}`;
  const targetId = `target-${pipeline.id}`;
  return {
    nodes: [
      { id: sourceId, type: 'source', position: { x: 80, y: 200 }, data: { label: pipeline.source_table || pipeline.source_connector?.name, connectorType: pipeline.source_connector?.type } },
      { id: targetId, type: 'target', position: { x: 500, y: 200 }, data: { label: pipeline.target_table || pipeline.target_connector?.name, connectorType: pipeline.target_connector?.type } },
    ],
    edges: [{ id: `edge-${pipeline.id}`, source: sourceId, target: targetId, animated: true, style: edgeStyle }],
  };
}

interface NewPipelineForm {
  name: string;
  source_connector_id: string;
  target_connector_id: string;
  source_table: string;
  target_table: string;
  direction: PipelineDirection;
}

const emptyForm: NewPipelineForm = { name: '', source_connector_id: '', target_connector_id: '', source_table: '', target_table: '', direction: 'cloud_bound' };

export default function CanvasPage() {
  return (
    <Suspense fallback={null}>
      <CanvasPageInner />
    </Suspense>
  );
}

function CanvasPageInner() {
  const searchParams = useSearchParams();
  const deepLinkPipelineId = searchParams.get('pipeline');

  const [pipelines, setPipelines] = useState<(Pipeline & { source_table?: string; target_table?: string })[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewPipelineForm>(emptyForm);
  const [sourceTables, setSourceTables] = useState<string[]>([]);
  const [targetTables, setTargetTables] = useState<string[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const selectedPipeline = pipelines.find((p) => p.id === selectedId);

  async function loadPipelines() {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([fetch('/api/pipelines'), fetch('/api/connectors')]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      setPipelines(pData.pipelines || []);
      setConnectors(cData.connectors || []);
      if (!selectedId) {
        const preferred = deepLinkPipelineId && pData.pipelines?.some((p: Pipeline) => p.id === deepLinkPipelineId)
          ? deepLinkPipelineId
          : pData.pipelines?.[0]?.id;
        if (preferred) setSelectedId(preferred);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPipelines(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedPipeline) { setNodes([]); setEdges([]); return; }
    (async () => {
      const res = await fetch(`/api/pipelines/${selectedPipeline.id}/canvas`);
      const data = await res.json();
      if (data.nodes?.length > 0) {
        setNodes(data.nodes.map((n: { id: string; type: string; label: string; connector_type?: string; position_x: number; position_y: number }) => ({
          id: n.id, type: n.type, position: { x: n.position_x, y: n.position_y }, data: { label: n.label, connectorType: n.connector_type },
        })));
        setEdges(data.edges.map((e: { id: string; source_node: string; target_node: string; animated: boolean }) => ({
          id: e.id, source: e.source_node, target: e.target_node, animated: e.animated, style: edgeStyle,
        })));
      } else {
        const { nodes: dn, edges: de } = defaultCanvas(selectedPipeline);
        setNodes(dn);
        setEdges(de);
      }
      setRunResult(null);
    })();
  }, [selectedPipeline?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true, style: edgeStyle }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData('application/json'));
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: data.type,
      position: { x: event.clientX - 400, y: event.clientY - 100 },
      data: { label: data.label },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  async function handleSave() {
    if (!selectedPipeline) return;
    setSaving(true);
    try {
      await fetch(`/api/pipelines/${selectedPipeline.id}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({ id: n.id, type: n.type, label: n.data.label, connector_type: n.data.connectorType, position_x: n.position.x, position_y: n.position.y })),
          edges: edges.map((e) => ({ id: e.id, source_node: e.source, target_node: e.target, animated: !!e.animated })),
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    if (!selectedPipeline) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`/api/pipelines/${selectedPipeline.id}/run`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRunResult({ status: 'success', message: `Synced ${data.recordsLoaded} of ${data.recordsExtracted} extracted rows.` });
      } else {
        setRunResult({ status: 'error', message: data.error || 'Run failed' });
      }
      loadPipelines();
    } finally {
      setRunning(false);
    }
  }

  async function loadTablesFor(connectorId: string, which: 'source' | 'target') {
    if (!connectorId) { (which === 'source' ? setSourceTables : setTargetTables)([]); return; }
    const res = await fetch(`/api/schema/tables?connector_id=${connectorId}`);
    const data = await res.json();
    (which === 'source' ? setSourceTables : setTargetTables)(data.tables || []);
  }

  async function handleCreatePipeline() {
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setShowModal(false);
      setForm(emptyForm);
      await loadPipelines();
      setSelectedId(data.pipeline.id);
    }
  }

  return (
    <>
      <TopBar title="Visual Pipeline Canvas" subtitle={selectedPipeline ? `Editing: ${selectedPipeline.name}` : 'No pipeline selected'} />
      <div className="flex items-center gap-3 px-6 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
        <select
          className="input-field w-auto text-xs"
          style={{ background: 'var(--color-bg-primary)' }}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {pipelines.length === 0 && <option value="">No pipelines yet</option>}
          {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn-secondary text-xs" onClick={() => setShowModal(true)}>+ New Pipeline</button>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-secondary text-xs" onClick={handleSave} disabled={!selectedPipeline || saving}>{saving ? 'Saving…' : '💾 Save'}</button>
          <button className="btn-primary text-xs" onClick={handleRun} disabled={!selectedPipeline || running}>{running ? 'Running…' : '▶️ Run'}</button>
        </div>
      </div>
      {runResult && (
        <div className="px-6 py-2 text-xs" style={{ background: runResult.status === 'success' ? 'rgba(20, 184, 166, 0.08)' : 'rgba(239, 68, 68, 0.08)', color: runResult.status === 'success' ? 'var(--color-accent-teal)' : 'var(--color-accent-coral)' }}>
          {runResult.message}
        </div>
      )}
      <div className="flex relative" style={{ height: 'calc(100vh - 64px - 52px)' }}>
        {/* Node Palette */}
        <div className="w-[220px] p-4 space-y-2 overflow-y-auto border-r" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Drag to Canvas
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Annotations</p>
          {paletteItems.map((item) => (
            <div
              key={item.label}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify(item))}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-grab mb-1 transition-all hover:scale-[1.02]"
              style={{
                background: `rgba(${item.color === 'purple' ? '139,92,246' : '59,130,246'}, 0.06)`,
                border: `1px solid rgba(${item.color === 'purple' ? '139,92,246' : '59,130,246'}, 0.15)`,
              }}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
            </div>
          ))}
          <p className="text-[10px] leading-relaxed mt-4" style={{ color: 'var(--color-text-muted)' }}>
            Source and Target nodes come from the pipeline&apos;s real connectors and are shown automatically. Transform/Filter are visual annotations only — Run performs a direct column-mapped copy.
          </p>
        </div>

        {/* Canvas */}
        <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
          ) : !selectedPipeline ? (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--color-text-muted)' }}>Create a pipeline to get started.</div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              proOptions={proOptions}
              fitView
              className="bg-transparent"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(148,163,184,0.08)" />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  if (node.type === 'source') return '#f59e0b';
                  if (node.type === 'target') return '#14b8a6';
                  if (node.type === 'transform') return '#8b5cf6';
                  return '#3b82f6';
                }}
                maskColor="rgba(10, 14, 26, 0.7)"
                style={{ background: 'var(--color-bg-surface)' }}
              />
            </ReactFlow>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="glass-strong rounded-2xl p-6 w-full max-w-lg animate-fade-in-scale">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>New Pipeline</h3>
              <button onClick={() => setShowModal(false)} className="text-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Name</label>
                <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer Sync" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Source Connector</label>
                  <select className="input-field" style={{ background: 'var(--color-bg-primary)' }} value={form.source_connector_id}
                    onChange={(e) => { setForm({ ...form, source_connector_id: e.target.value, source_table: '' }); loadTablesFor(e.target.value, 'source'); }}>
                    <option value="">Select…</option>
                    {connectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Source Table</label>
                  <select className="input-field" style={{ background: 'var(--color-bg-primary)' }} value={form.source_table}
                    onChange={(e) => setForm({ ...form, source_table: e.target.value })} disabled={sourceTables.length === 0}>
                    <option value="">Select…</option>
                    {sourceTables.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Target Connector</label>
                  <select className="input-field" style={{ background: 'var(--color-bg-primary)' }} value={form.target_connector_id}
                    onChange={(e) => { setForm({ ...form, target_connector_id: e.target.value, target_table: '' }); loadTablesFor(e.target.value, 'target'); }}>
                    <option value="">Select…</option>
                    {connectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Target Table</label>
                  <select className="input-field" style={{ background: 'var(--color-bg-primary)' }} value={form.target_table}
                    onChange={(e) => setForm({ ...form, target_table: e.target.value })} disabled={targetTables.length === 0}>
                    <option value="">Select…</option>
                    {targetTables.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Direction</label>
                <select className="input-field" style={{ background: 'var(--color-bg-primary)' }} value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value as PipelineDirection })}>
                  <option value="cloud_bound">Cloud-bound</option>
                  <option value="on_prem_bound">On-Prem-bound</option>
                  <option value="bidirectional">Bidirectional</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
                <button
                  className="btn-primary flex-1 disabled:opacity-50"
                  disabled={!form.name || !form.source_connector_id || !form.target_connector_id || !form.source_table || !form.target_table}
                  onClick={handleCreatePipeline}
                >
                  Create Pipeline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
