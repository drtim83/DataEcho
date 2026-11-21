import { NextResponse } from 'next/server';
import { requireAdmin, errorMessage } from '@/lib/firebase/server';
import { isConnectorReferenced } from '@/lib/firebase/db-helpers';
import { logAudit } from '@/lib/audit';
import { syncConnectorQuantity } from '@/lib/billing-helpers';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, admin } = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!admin) return NextResponse.json({ error: 'Only admins can manage connectors' }, { status: 403 });

    const { id } = await params;

    if (await isConnectorReferenced(db, id)) {
      return NextResponse.json(
        { error: 'This connector is still used by one or more pipelines. Delete those pipelines first.' },
        { status: 409 }
      );
    }

    const ref = db.collection('connectors').doc(id);
    const existingSnap = await ref.get();
    const existingName = existingSnap.exists ? (existingSnap.data()?.name as string | undefined) : undefined;

    await ref.delete();

    await logAudit(db, {
      action: 'connector.delete',
      actor: user.email ?? user.id,
      status: 'success',
      details: existingName ? `Deleted connector "${existingName}"` : `Deleted connector ${id}`,
    });

    await syncConnectorQuantity(db);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/connectors/[id] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to delete connector') }, { status: 500 });
  }
}
