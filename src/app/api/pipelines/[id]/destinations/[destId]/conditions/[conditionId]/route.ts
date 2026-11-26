import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; destId: string; conditionId: string }> }) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { destId, conditionId } = await params;

    const ref = db.collection('pipeline_destination_conditions').doc(conditionId);
    const snap = await ref.get();
    if (snap.exists && snap.data()?.destination_id === destId) {
      await ref.delete();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/pipelines/[id]/destinations/[destId]/conditions/[conditionId] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to remove condition') }, { status: 500 });
  }
}
