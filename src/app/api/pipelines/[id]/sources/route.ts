import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

// Additional sources for a pipeline, combined with the primary source via
// UNION ALL (same schema mapping applied to every source) when the pipeline
// runs. See src/lib/db-sync.ts::runSync.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { data, error } = await supabase
      .from('pipeline_sources')
      .select('*, connector:connectors(id, name, type, category, role, config, status)')
      .eq('pipeline_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ sources: data });
  } catch (error) {
    console.error('GET /api/pipelines/[id]/sources failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load sources') }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { source_id, source_table, combine_mode, join_type, join_column, primary_join_column } = body;

    if (!source_id || !source_table) {
      return NextResponse.json({ error: 'source_id and source_table are required' }, { status: 400 });
    }
    if (combine_mode && !['union', 'join'].includes(combine_mode)) {
      return NextResponse.json({ error: 'combine_mode must be "union" or "join"' }, { status: 400 });
    }
    if (combine_mode === 'join' && (!join_column || !primary_join_column)) {
      return NextResponse.json({ error: 'join_column and primary_join_column are required for combine_mode "join"' }, { status: 400 });
    }
    if (join_type && !['inner', 'left'].includes(join_type)) {
      return NextResponse.json({ error: 'join_type must be "inner" or "left"' }, { status: 400 });
    }

    const { data: pipeline } = await supabase.from('pipelines').select('name').eq('id', id).single();

    const { data, error } = await supabase
      .from('pipeline_sources')
      .insert({
        pipeline_id: id,
        source_id,
        source_table,
        combine_mode: combine_mode || 'union',
        join_type: join_type || 'inner',
        join_column: combine_mode === 'join' ? join_column : null,
        primary_join_column: combine_mode === 'join' ? primary_join_column : null,
      })
      .select('*, connector:connectors(id, name, type, category, role, config, status)')
      .single();

    if (error) throw error;

    const modeSummary = combine_mode === 'join' ? `joined on ${primary_join_column} = ${join_column} (${join_type || 'inner'})` : 'unioned';

    await logAudit(supabase, {
      action: 'pipeline.source.add',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Added an additional source (${source_table}, ${modeSummary}) to pipeline "${pipeline?.name ?? id}"`,
      pipeline_id: id,
    });

    return NextResponse.json({ source: data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/pipelines/[id]/sources failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to add source') }, { status: 500 });
  }
}
