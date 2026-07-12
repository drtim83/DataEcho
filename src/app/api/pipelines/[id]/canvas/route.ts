import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const [{ data: nodes, error: nodesError }, { data: edges, error: edgesError }] = await Promise.all([
      supabase.from('pipeline_nodes').select('*').eq('pipeline_id', id),
      supabase.from('pipeline_edges').select('*').eq('pipeline_id', id),
    ]);

    if (nodesError) throw nodesError;
    if (edgesError) throw edgesError;

    return NextResponse.json({ nodes, edges });
  } catch (error) {
    console.error('GET /api/pipelines/[id]/canvas failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load canvas') }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { nodes, edges } = body as {
      nodes: { id: string; type: string; label: string; connector_type?: string; position_x: number; position_y: number; config?: Record<string, unknown> }[];
      edges: { id: string; source_node: string; target_node: string; animated?: boolean }[];
    };

    // Replace-all is simplest and matches how the canvas UI saves (full snapshot each time).
    const { error: delNodesError } = await supabase.from('pipeline_nodes').delete().eq('pipeline_id', id);
    if (delNodesError) throw delNodesError;
    const { error: delEdgesError } = await supabase.from('pipeline_edges').delete().eq('pipeline_id', id);
    if (delEdgesError) throw delEdgesError;

    if (nodes.length > 0) {
      const { error } = await supabase.from('pipeline_nodes').insert(
        nodes.map((n) => ({
          id: n.id, pipeline_id: id, type: n.type, label: n.label,
          connector_type: n.connector_type, position_x: n.position_x, position_y: n.position_y,
          config: n.config || {},
        }))
      );
      if (error) throw error;
    }

    if (edges.length > 0) {
      const { error } = await supabase.from('pipeline_edges').insert(
        edges.map((e) => ({ id: e.id, pipeline_id: id, source_node: e.source_node, target_node: e.target_node, animated: e.animated ?? true }))
      );
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/pipelines/[id]/canvas failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to save canvas') }, { status: 500 });
  }
}
