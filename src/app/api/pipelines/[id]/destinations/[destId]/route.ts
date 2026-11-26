import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';
import { deleteDestinationCascade, sanitizeConnectorConfig } from '@/lib/firebase/db-helpers';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; destId: string }> }) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, destId } = await params;
    const { match_mode } = await req.json();

    if (!match_mode || !['all', 'any'].includes(match_mode)) {
      return NextResponse.json({ error: 'match_mode must be "all" or "any"' }, { status: 400 });
    }

    const ref = db.collection('pipeline_destinations').doc(destId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.pipeline_id !== id) {
      return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
    }

    await ref.update({ match_mode });
    const updatedData: Record<string, unknown> = { ...snap.data()!, match_mode };

    const [connectorSnap, conditionsSnap] = await Promise.all([
      db.collection('connectors').doc(updatedData.target_id as string).get(),
      db.collection('pipeline_destination_conditions').where('destination_id', '==', destId).get(),
    ]);

    const c = connectorSnap.exists ? connectorSnap.data()! : null;
    const destination = {
      id: destId,
      ...updatedData,
      connector: c
        ? {
            id: connectorSnap.id,
            name: c.name,
            type: c.type,
            category: c.category,
            role: c.role,
            config: sanitizeConnectorConfig(c.config as Record<string, unknown> | undefined),
            status: c.status,
          }
        : null,
      pipeline_destination_conditions: conditionsSnap.docs.map((cd) => {
        const d = cd.data();
        return {
          id: cd.id,
          filter_column: d.filter_column,
          filter_operator: d.filter_operator,
          filter_value: d.filter_value,
        };
      }),
    };

    return NextResponse.json({ destination });
  } catch (error) {
    console.error('PATCH /api/pipelines/[id]/destinations/[destId] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to update destination') }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; destId: string }> }) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, destId } = await params;

    const snap = await db.collection('pipeline_destinations').doc(destId).get();
    if (snap.exists && snap.data()?.pipeline_id === id) {
      await deleteDestinationCascade(db, destId);
    }

    await logAudit(db, {
      action: 'pipeline.destination.remove',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Removed a destination from pipeline ${id}`,
      pipeline_id: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/pipelines/[id]/destinations/[destId] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to remove destination') }, { status: 500 });
  }
}
