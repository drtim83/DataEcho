import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; destId: string; conditionId: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { destId, conditionId } = await params;

    const { error } = await supabase.from('pipeline_destination_conditions').delete().eq('id', conditionId).eq('destination_id', destId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/pipelines/[id]/destinations/[destId]/conditions/[conditionId] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to remove condition') }, { status: 500 });
  }
}
