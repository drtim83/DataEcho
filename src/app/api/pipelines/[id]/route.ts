import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';
import { deletePipelineCascade } from '@/lib/firebase/db-helpers';
import { logAudit } from '@/lib/audit';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const existingSnap = await db.collection('pipelines').doc(id).get();
    const existingName = existingSnap.exists ? (existingSnap.data()?.name as string | undefined) : undefined;

    await deletePipelineCascade(db, id);

    await logAudit(db, {
      action: 'pipeline.delete',
      actor: user.email ?? user.id,
      status: 'success',
      details: existingName ? `Deleted pipeline "${existingName}"` : `Deleted pipeline ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/pipelines/[id] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to delete pipeline') }, { status: 500 });
  }
}
