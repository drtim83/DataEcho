import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';
import { commitDeletes } from '@/lib/firebase/db-helpers';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const [nodesSnap, edgesSnap] = await Promise.all([
      db.collection('pipeline_nodes').where('pipeline_id', '==', id).get(),
      db.collection('pipeline_edges').where('pipeline_id', '==', id).get(),
    ]);

    const nodes = nodesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const edges = edgesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ nodes, edges });
  } catch (error) {
    console.error('GET /api/pipelines/[id]/canvas failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load canvas') }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { nodes, edges } = body as {
      nodes: { id: string; type: string; label: string; connector_type?: string; position_x: number; position_y: number; config?: Record<string, unknown> }[];
      edges: { id: string; source_node: string; target_node: string; animated?: boolean }[];
    };

    // Replace-all is simplest and matches how the canvas UI saves (full snapshot each time).
    const [oldNodesSnap, oldEdgesSnap] = await Promise.all([
      db.collection('pipeline_nodes').where('pipeline_id', '==', id).get(),
      db.collection('pipeline_edges').where('pipeline_id', '==', id).get(),
    ]);
    await commitDeletes(db, [
      ...oldNodesSnap.docs.map((d) => d.ref),
      ...oldEdgesSnap.docs.map((d) => d.ref),
    ]);

    if (nodes.length > 0) {
      for (let i = 0; i < nodes.length; i += 450) {
        const batch = db.batch();
        for (const n of nodes.slice(i, i + 450)) {
          const ref = db.collection('pipeline_nodes').doc(n.id);
          batch.set(ref, {
            id: n.id,
            pipeline_id: id,
            type: n.type,
            label: n.label,
            connector_type: n.connector_type ?? null,
            position_x: n.position_x,
            position_y: n.position_y,
            config: n.config || {},
          });
        }
        await batch.commit();
      }
    }

    if (edges.length > 0) {
      for (let i = 0; i < edges.length; i += 450) {
        const batch = db.batch();
        for (const e of edges.slice(i, i + 450)) {
          const ref = db.collection('pipeline_edges').doc(e.id);
          batch.set(ref, {
            id: e.id,
            pipeline_id: id,
            source_node: e.source_node,
            target_node: e.target_node,
            animated: e.animated ?? true,
          });
        }
        await batch.commit();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/pipelines/[id]/canvas failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to save canvas') }, { status: 500 });
  }
}
