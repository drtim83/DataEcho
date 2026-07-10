'use client';

import { useCallback, useMemo, useState } from 'react';
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
import TopBar from '@/components/layout/TopBar';
import { mockPipelineNodes, mockPipelineEdges } from '@/lib/mock-data';
import { getConnectorIcon, getConnectorLabel } from '@/lib/utils';

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
    </div>
  );
}

const nodeTypes = {
  source: SourceNodeComponent,
  target: TargetNodeComponent,
  transform: TransformNodeComponent,
  filter: FilterNodeComponent,
};

// Palette items for dragging
const paletteItems = [
  { type: 'source', label: 'MS SQL Server', icon: '🗄️', connectorType: 'mssql', color: 'amber' },
  { type: 'source', label: 'Oracle DB', icon: '🔴', connectorType: 'oracle', color: 'amber' },
  { type: 'source', label: 'IBM DB2', icon: '🔵', connectorType: 'db2', color: 'amber' },
  { type: 'target', label: 'Snowflake', icon: '❄️', connectorType: 'snowflake', color: 'teal' },
  { type: 'target', label: 'Databricks', icon: '🔶', connectorType: 'databricks', color: 'teal' },
  { type: 'target', label: 'Iceberg', icon: '🧊', connectorType: 'iceberg', color: 'teal' },
  { type: 'transform', label: 'Transform', icon: '⚙️', color: 'purple' },
  { type: 'filter', label: 'Filter', icon: '🔍', color: 'blue' },
];

export default function CanvasPage() {
  const initialNodes: Node[] = mockPipelineNodes.map(n => ({
    id: n.id,
    type: n.type,
    position: { x: n.position_x, y: n.position_y },
    data: { label: n.label, connectorType: n.connector_type, config: n.config },
  }));

  const initialEdges: Edge[] = mockPipelineEdges.map(e => ({
    id: e.id,
    source: e.source_node,
    target: e.target_node,
    animated: e.animated,
    style: { stroke: 'var(--color-accent-blue)', strokeWidth: 2, strokeDasharray: '6 3' },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedPipeline] = useState('Customer 360 Sync');

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({
      ...connection,
      animated: true,
      style: { stroke: 'var(--color-accent-blue)', strokeWidth: 2, strokeDasharray: '6 3' },
    }, eds));
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
      data: { label: data.label, connectorType: data.connectorType },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  return (
    <>
      <TopBar title="Visual Pipeline Canvas" subtitle={`Editing: ${selectedPipeline}`} />
      <div className="flex" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Node Palette */}
        <div className="w-[220px] p-4 space-y-2 overflow-y-auto border-r" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Drag to Canvas
          </p>

          {['Sources', 'Targets', 'Transforms'].map((group) => {
            const items = paletteItems.filter(p =>
              group === 'Sources' ? p.type === 'source' :
              group === 'Targets' ? p.type === 'target' :
              p.type === 'transform' || p.type === 'filter'
            );
            return (
              <div key={group} className="mb-4">
                <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>{group}</p>
                {items.map((item) => (
                  <div
                    key={item.label}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify(item));
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-grab mb-1 transition-all hover:scale-[1.02]"
                    style={{
                      background: `rgba(${item.color === 'amber' ? '245,158,11' : item.color === 'teal' ? '20,184,166' : item.color === 'purple' ? '139,92,246' : '59,130,246'}, 0.06)`,
                      border: `1px solid rgba(${item.color === 'amber' ? '245,158,11' : item.color === 'teal' ? '20,184,166' : item.color === 'purple' ? '139,92,246' : '59,130,246'}, 0.15)`,
                    }}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
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
        </div>

        {/* Toolbar */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 ml-[120px] flex items-center gap-2 px-4 py-2 rounded-xl glass-strong">
          {[
            { icon: '💾', label: 'Save' },
            { icon: '▶️', label: 'Run' },
            { icon: '✅', label: 'Validate' },
            { icon: '📐', label: 'Auto-layout' },
          ].map(btn => (
            <button key={btn.label} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <span>{btn.icon}</span> {btn.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
