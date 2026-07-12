import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; destId: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, destId } = await params;
    const { match_mode } = await req.json();

    if (!match_mode || !['all', 'any'].includes(match_mode)) {
      return NextResponse.json({ error: 'match_mode must be "all" or "any"' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pipeline_destinations')
      .update({ match_mode })
      .eq('id', destId)
      .eq('pipeline_id', id)
      .select('*, connector:connectors(id, name, type, category, role, config, status), pipeline_destination_conditions(id, filter_column, filter_operator, filter_value)')
      .single();

    if (error) throw error;

    return NextResponse.json({ destination: data });
  } catch (error) {
    console.error('PATCH /api/pipelines/[id]/destinations/[destId] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to update destination') }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; destId: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, destId } = await params;

    const { error } = await supabase.from('pipeline_destinations').delete().eq('id', destId).eq('pipeline_id', id);
    if (error) throw error;

    await logAudit(supabase, {
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
