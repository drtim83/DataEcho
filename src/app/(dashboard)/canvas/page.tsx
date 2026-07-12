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
import type { Connector, CombineMode, FilterOperator, JoinType, MatchMode, Pipeline, PipelineDestination, PipelineDirection, PipelineSource, SyncMode } from '@/types';

const FILTER_OPERATORS: FilterOperator[] = ['=', '!=', '>', '<', '>=', '<=', 'contains'];

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
  sync_mode: SyncMode;
}

const emptyForm: NewPipelineForm = { name: '', source_connector_id: '', target_connector_id: '', source_table: '', target_table: '', direction: 'cloud_bound', sync_mode: 'append' };

interface SourceForm {
  source_connector_id: string;
  source_table: string;
  combine_mode: CombineMode;
  join_type: JoinType;
  join_column: string;
  primary_join_column: string;
}
const emptySourceForm: SourceForm = { source_connector_id: '', source_table: '', combine_mode: 'union', join_type: 'inner', join_column: '', primary_join_column: '' };

interface DestinationForm {
  target_connector_id: string;
  target_table: string;
  filter_column: string;
  filter_operator: FilterOperator;
  filter_value: string;
}
const emptyDestinationForm: DestinationForm = { target_connector_id: '', target_table: '', filter_column: '', filter_operator: '=', filter_value: '' };

interface ConditionDraft {
  filter_column: string;
  filter_operator: FilterOperator;
  filter_value: string;
}
const emptyConditionDraft: ConditionDraft = { filter_column: '', filter_operator: '=', filter_value: '' };

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
  const [deleting, setDeleting] = useState(false);
  const [runResult, setRunResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewPipelineForm>(emptyForm);
  const [sourceTables, setSourceTables] = useState<string[]>([]);
  const [targetTables, setTargetTables] = useState<string[]>([]);

  const [showFanoutModal, setShowFanoutModal] = useState(false);
  const [pipelineSources, setPipelineSources] = useState<PipelineSource[]>([]);
  const [pipelineDestinations, setPipelineDestinations] = useState<PipelineDestination[]>([]);
  const [sourceForm, setSourceForm] = useState<SourceForm>(emptySourceForm);
  const [sourceFormTables, setSourceFormTables] = useState<string[]>([]);
  const [destForm, setDestForm] = useState<DestinationForm>(emptyDestinationForm);
  const [destFormTables, setDestFormTables] = useState<string[]>([]);
  const [fanoutSaving, setFanoutSaving] = useState(false);
  const [conditionDrafts, setConditionDrafts] = useState<Record<string, ConditionDraft>>({});

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

  async function handleDelete() {
    if (!selectedPipeline) return;
    if (!confirm(`Delete pipeline "${selectedPipeline.name}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pipelines/${selectedPipeline.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedId('');
        await loadPipelines();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function loadTablesFor(connectorId: string, which: 'source' | 'target') {
    if (!connectorId) { (which === 'source' ? setSourceTables : setTargetTables)([]); return; }
    const res = await fetch(`/api/schema/tables?connector_id=${connectorId}`);
    const data = await res.json();
    (which === 'source' ? setSourceTables : setTargetTables)(data.tables || []);
  }

  async function loadFanout(pipelineId: string) {
    const [sRes, dRes] = await Promise.all([
      fetch(`/api/pipelines/${pipelineId}/sources`),
      fetch(`/api/pipelines/${pipelineId}/destinations`),
    ]);
    const sData = await sRes.json();
    const dData = await dRes.json();
    setPipelineSources(sData.sources || []);
    setPipelineDestinations(dData.destinations || []);
  }

  function openFanoutModal() {
    if (!selectedPipeline) return;
    setSourceForm(emptySourceForm);
    setSourceFormTables([]);
    setDestForm(emptyDestinationForm);
    setDestFormTables([]);
    loadFanout(selectedPipeline.id);
    setShowFanoutModal(true);
  }

  async function loadTablesForFanout(connectorId: string, which: 'source' | 'dest') {
    if (!connectorId) { (which === 'source' ? setSourceFormTables : setDestFormTables)([]); return; }
    const res = await fetch(`/api/schema/tables?connector_id=${connectorId}`);
    const data = await res.json();
    (which === 'source' ? setSourceFormTables : setDestFormTables)(data.tables || []);
  }

  async function handleAddSource() {
    if (!selectedPipeline || !sourceForm.source_connector_id || !sourceForm.source_table) return;
    if (sourceForm.combine_mode === 'join' && (!sourceForm.join_column || !sourceForm.primary_join_column)) return;
    setFanoutSaving(true);
    try {
      const res = await fetch(`/api/pipelines/${selectedPipeline.id}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: sourceForm.source_connector_id,
          source_table: sourceForm.source_table,
          combine_mode: sourceForm.combine_mode,
          join_type: sourceForm.join_type,
          join_column: sourceForm.combine_mode === 'join' ? sourceForm.join_column : undefined,
          primary_join_column: sourceForm.combine_mode === 'join' ? sourceForm.primary_join_column : undefined,
        }),
      });
      if (res.ok) {
        setSourceForm(emptySourceForm);
        setSourceFormTables([]);
        await loadFanout(selectedPipeline.id);
      }
    } finally {
      setFanoutSaving(false);
    }
  }

  async function handleDeleteSource(sourceId: string) {
    if (!selectedPipeline) return;
    await fetch(`/api/pipelines/${selectedPipeline.id}/sources/${sourceId}`, { method: 'DELETE' });
    await loadFanout(selectedPipeline.id);
  }

  async function handleAddDestination() {
    if (!selectedPipeline || !destForm.target_connector_id || !destForm.target_table || !destForm.filter_column || !destForm.filter_value) return;
    setFanoutSaving(true);
    try {
      const res = await fetch(`/api/pipelines/${selectedPipeline.id}/destinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_id: destForm.target_connector_id,
          target_table: destForm.target_table,
          filter_column: destForm.filter_column,
          filter_operator: destForm.filter_operator,
          filter_value: destForm.filter_value,
        }),
      });
      if (res.ok) {
        setDestForm(emptyDestinationForm);
        setDestFormTables([]);
        await loadFanout(selectedPipeline.id);
      }
    } finally {
      setFanoutSaving(false);
    }
  }

  async function handleDeleteDestination(destId: string) {
    if (!selectedPipeline) return;
    await fetch(`/api/pipelines/${selectedPipeline.id}/destinations/${destId}`, { method: 'DELETE' });
    await loadFanout(selectedPipeline.id);
  }

  async function handleMatchModeChange(destId: string, matchMode: MatchMode) {
    if (!selectedPipeline) return;
    await fetch(`/api/pipelines/${selectedPipeline.id}/destinations/${destId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_mode: matchMode }),
    });
    await loadFanout(selectedPipeline.id);
  }

  async function handleAddCondition(destId: string) {
    if (!selectedPipeline) return;
    const draft = conditionDrafts[destId] ?? emptyConditionDraft;
    if (!draft.filter_column || !draft.filter_value) return;
    await fetch(`/api/pipelines/${selectedPipeline.id}/destinations/${destId}/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    setConditionDrafts((prev) => ({ ...prev, [destId]: emptyConditionDraft }));
    await loadFanout(selectedPipeline.id);
  }

  async function handleDeleteCondition(destId: string, conditionId: string) {
    if (!selectedPipeline) return;
    await fetch(`/api/pipelines/${selectedPipeline.id}/destinations/${destId}/conditions/${conditionId}`, { method: 'DELETE' });
    await loadFanout(selectedPipeline.id);
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
      <div className="flex items-center gap-3 px-6 py-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
        <select
          className="input-field text-xs flex-shrink-0"
          style={{ background: 'var(--color-bg-primary)', width: '200px' }}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {pipelines.length === 0 && <option value="">No pipelines yet</option>}
          {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn-secondary text-xs whitespace-nowrap flex-shrink-0" onClick={() => setShowModal(true)}>+ New Pipeline</button>
        <button className="btn-secondary text-xs whitespace-nowrap flex-shrink-0 disabled:opacity-50" onClick={openFanoutModal} disabled={!selectedPipeline}>🔀 Sources &amp; Targets</button>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <button
            className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap disabled:opacity-50"
            style={{ color: 'var(--color-accent-coral)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            onClick={handleDelete}
            disabled={!selectedPipeline || deleting}
          >
            {deleting ? 'Deleting…' : '🗑️ Delete'}
          </button>
          <button className="btn-secondary text-xs whitespace-nowrap" onClick={handleSave} disabled={!selectedPipeline || saving}>{saving ? 'Saving…' : '💾 Save'}</button>
          <button className="btn-primary text-xs whitespace-nowrap" onClick={handleRun} disabled={!selectedPipeline || running}>{running ? 'Running…' : '▶️ Run'}</button>
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
                    {connectors.filter((c) => c.role !== 'target').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                    {connectors.filter((c) => c.role !== 'source').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Sync Mode</label>
                <select className="input-field" style={{ background: 'var(--color-bg-primary)' }} value={form.sync_mode}
                  onChange={(e) => setForm({ ...form, sync_mode: e.target.value as SyncMode })}>
                  <option value="append">Append (insert every run)</option>
                  <option value="truncate_reload">Truncate & Reload (clear target before every run)</option>
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

      {showFanoutModal && selectedPipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="glass-strong rounded-2xl p-6 w-full max-w-2xl animate-fade-in-scale" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Sources &amp; Destinations</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{selectedPipeline.name}</p>
              </div>
              <button onClick={() => setShowFanoutModal(false)} className="text-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>✕</button>
            </div>

            {/* Additional Sources */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Additional Sources (UNION / JOIN)</h4>
              <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                <strong>Union</strong>: extracted alongside the primary source and concatenated — tables must share the mapping&apos;s source columns. <strong>Join</strong>: matched to the current rows by key and merged in — a real cross-database JOIN can&apos;t run in SQL here, so this runs as an in-memory join.
              </p>
              {pipelineSources.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {pipelineSources.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg-primary)' }}>
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {s.connector?.name ?? s.source_id} · <span className="font-mono">{s.source_table}</span>
                        {s.combine_mode === 'join' ? (
                          <> · JOIN ({s.join_type}) on <span className="font-mono">{s.primary_join_column} = {s.join_column}</span></>
                        ) : ' · UNION'}
                      </span>
                      <button onClick={() => handleDeleteSource(s.id)} className="text-[10px] cursor-pointer" style={{ color: 'var(--color-accent-coral)' }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <select className="input-field text-xs" style={{ background: 'var(--color-bg-primary)' }} value={sourceForm.source_connector_id}
                    onChange={(e) => { setSourceForm({ ...sourceForm, source_connector_id: e.target.value, source_table: '' }); loadTablesForFanout(e.target.value, 'source'); }}>
                    <option value="">Connector…</option>
                    {connectors.filter((c) => c.role !== 'target').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className="input-field text-xs" style={{ background: 'var(--color-bg-primary)' }} value={sourceForm.source_table}
                    onChange={(e) => setSourceForm({ ...sourceForm, source_table: e.target.value })} disabled={sourceFormTables.length === 0}>
                    <option value="">Table…</option>
                    {sourceFormTables.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select className="input-field text-xs w-auto" style={{ background: 'var(--color-bg-primary)' }} value={sourceForm.combine_mode}
                    onChange={(e) => setSourceForm({ ...sourceForm, combine_mode: e.target.value as CombineMode })}>
                    <option value="union">Union</option>
                    <option value="join">Join</option>
                  </select>
                </div>
                {sourceForm.combine_mode === 'join' && (
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
                    <input className="input-field text-xs" placeholder="Primary source column (e.g. customer_id)" value={sourceForm.primary_join_column}
                      onChange={(e) => setSourceForm({ ...sourceForm, primary_join_column: e.target.value })} />
                    <input className="input-field text-xs" placeholder="This source's column (e.g. id)" value={sourceForm.join_column}
                      onChange={(e) => setSourceForm({ ...sourceForm, join_column: e.target.value })} />
                    <select className="input-field text-xs w-auto" style={{ background: 'var(--color-bg-primary)' }} value={sourceForm.join_type}
                      onChange={(e) => setSourceForm({ ...sourceForm, join_type: e.target.value as JoinType })}>
                      <option value="inner">Inner</option>
                      <option value="left">Left</option>
                    </select>
                    <button className="btn-secondary text-xs disabled:opacity-50" disabled={fanoutSaving || !sourceForm.source_connector_id || !sourceForm.source_table || !sourceForm.join_column || !sourceForm.primary_join_column} onClick={handleAddSource}>+ Add</button>
                  </div>
                )}
                {sourceForm.combine_mode === 'union' && (
                  <div className="flex justify-end">
                    <button className="btn-secondary text-xs disabled:opacity-50" disabled={fanoutSaving || !sourceForm.source_connector_id || !sourceForm.source_table} onClick={handleAddSource}>+ Add</button>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Destinations */}
            <div>
              <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Additional Destinations (filtered push-back)</h4>
              <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Each destination gets the subset of extracted rows matching its filter, e.g. push rows where <code>region = APAC</code> to a regional system.
              </p>
              {pipelineDestinations.length > 0 && (
                <div className="space-y-2 mb-3">
                  {pipelineDestinations.map((d) => {
                    const extraConditions = d.pipeline_destination_conditions ?? [];
                    const draft = conditionDrafts[d.id] ?? emptyConditionDraft;
                    return (
                      <div key={d.id} className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--color-bg-primary)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {d.connector?.name ?? d.target_id} · <span className="font-mono">{d.target_table}</span>
                          </span>
                          <button onClick={() => handleDeleteDestination(d.id)} className="text-[10px] cursor-pointer" style={{ color: 'var(--color-accent-coral)' }}>Remove destination</button>
                        </div>

                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="badge badge-blue text-[10px] font-mono">{d.filter_column} {d.filter_operator} {d.filter_value}</span>
                          {extraConditions.length > 0 && (
                            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{d.match_mode === 'any' ? 'OR' : 'AND'}</span>
                          )}
                          {extraConditions.map((c) => (
                            <span key={c.id} className="badge badge-blue text-[10px] font-mono flex items-center gap-1.5">
                              {c.filter_column} {c.filter_operator} {c.filter_value}
                              <button onClick={() => handleDeleteCondition(d.id, c.id)} className="cursor-pointer" style={{ color: 'var(--color-accent-coral)' }}>✕</button>
                            </span>
                          ))}
                        </div>

                        {extraConditions.length > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Match:</span>
                            <select className="input-field text-[10px] w-auto py-0.5" style={{ background: 'var(--color-bg-elevated)' }} value={d.match_mode}
                              onChange={(e) => handleMatchModeChange(d.id, e.target.value as MatchMode)}>
                              <option value="all">All conditions (AND)</option>
                              <option value="any">Any condition (OR)</option>
                            </select>
                          </div>
                        )}

                        <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] gap-1.5">
                          <input className="input-field text-[10px] py-1" placeholder="+ column" value={draft.filter_column}
                            onChange={(e) => setConditionDrafts((prev) => ({ ...prev, [d.id]: { ...draft, filter_column: e.target.value } }))} />
                          <select className="input-field text-[10px] w-auto py-1" style={{ background: 'var(--color-bg-elevated)' }} value={draft.filter_operator}
                            onChange={(e) => setConditionDrafts((prev) => ({ ...prev, [d.id]: { ...draft, filter_operator: e.target.value as FilterOperator } }))}>
                            {FILTER_OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                          </select>
                          <input className="input-field text-[10px] py-1" placeholder="value" value={draft.filter_value}
                            onChange={(e) => setConditionDrafts((prev) => ({ ...prev, [d.id]: { ...draft, filter_value: e.target.value } }))} />
                          <button className="text-[10px] px-2 rounded disabled:opacity-50 cursor-pointer" style={{ color: 'var(--color-accent-blue)' }}
                            disabled={!draft.filter_column || !draft.filter_value} onClick={() => handleAddCondition(d.id)}>+ Condition</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select className="input-field text-xs" style={{ background: 'var(--color-bg-primary)' }} value={destForm.target_connector_id}
                    onChange={(e) => { setDestForm({ ...destForm, target_connector_id: e.target.value, target_table: '' }); loadTablesForFanout(e.target.value, 'dest'); }}>
                    <option value="">Connector…</option>
                    {connectors.filter((c) => c.role !== 'source').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className="input-field text-xs" style={{ background: 'var(--color-bg-primary)' }} value={destForm.target_table}
                    onChange={(e) => setDestForm({ ...destForm, target_table: e.target.value })} disabled={destFormTables.length === 0}>
                    <option value="">Table…</option>
                    {destFormTables.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2">
                  <input className="input-field text-xs" placeholder="Filter column (e.g. region)" value={destForm.filter_column}
                    onChange={(e) => setDestForm({ ...destForm, filter_column: e.target.value })} />
                  <select className="input-field text-xs w-auto" style={{ background: 'var(--color-bg-primary)' }} value={destForm.filter_operator}
                    onChange={(e) => setDestForm({ ...destForm, filter_operator: e.target.value as FilterOperator })}>
                    {FILTER_OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <input className="input-field text-xs" placeholder="Value (e.g. APAC)" value={destForm.filter_value}
                    onChange={(e) => setDestForm({ ...destForm, filter_value: e.target.value })} />
                  <button className="btn-secondary text-xs disabled:opacity-50" disabled={fanoutSaving || !destForm.target_connector_id || !destForm.target_table || !destForm.filter_column || !destForm.filter_value} onClick={handleAddDestination}>+ Add</button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <button className="btn-primary text-xs" onClick={() => setShowFanoutModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
