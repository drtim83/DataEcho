import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, sourceId } = await params;

    const { error } = await supabase.from('pipeline_sources').delete().eq('id', sourceId).eq('pipeline_id', id);
    if (error) throw error;

    await logAudit(supabase, {
      action: 'pipeline.source.remove',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Removed an additional source from pipeline ${id}`,
      pipeline_id: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/pipelines/[id]/sources/[sourceId] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to remove source') }, { status: 500 });
  }
}
