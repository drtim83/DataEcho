import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/connectors/[id] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to delete connector') }, { status: 500 });
  }
}
