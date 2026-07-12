import { NextResponse } from 'next/server';
import { requireAdmin, errorMessage } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { syncConnectorQuantity } from '@/lib/billing-helpers';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, admin } = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!admin) return NextResponse.json({ error: 'Only admins can manage connectors' }, { status: 403 });

    const { id } = await params;

    const { data: existing } = await supabase.from('connectors').select('name').eq('id', id).single();

    const { error } = await supabase.from('connectors').delete().eq('id', id);
    if (error) throw error;

    await logAudit(supabase, {
      action: 'connector.delete',
      actor: user.email ?? user.id,
      status: 'success',
      details: existing?.name ? `Deleted connector "${existing.name}"` : `Deleted connector ${id}`,
    });

    await syncConnectorQuantity(supabase);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/connectors/[id] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to delete connector') }, { status: 500 });
  }
}
