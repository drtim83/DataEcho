import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { getConnectorConnectionInput } from '@/lib/connector-helpers';
import { getColumns } from '@/lib/db-schema';
import { mapSchemas } from '@/lib/schema-mapper';
import { logAudit } from '@/lib/audit';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pipelineId = new URL(req.url).searchParams.get('pipeline_id');
    if (!pipelineId) return NextResponse.json({ error: 'pipeline_id is required' }, { status: 400 });

    const { data, error } = await supabase.from('schema_mappings').select('*').eq('pipeline_id', pipelineId);
    if (error) throw error;

    return NextResponse.json({ mappings: data });
  } catch (error) {
    console.error('GET /api/schema/map failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load mappings') }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { pipeline_id } = await req.json();
    if (!pipeline_id) return NextResponse.json({ error: 'pipeline_id is required' }, { status: 400 });

    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('source_id, target_id, source_table, target_table, name')
      .eq('id', pipeline_id)
      .single();

    if (pipelineError || !pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }
    if (!pipeline.source_table || !pipeline.target_table) {
      return NextResponse.json({ error: 'Pipeline is missing a source or target table' }, { status: 400 });
    }

    const [sourceConn, targetConn] = await Promise.all([
      getConnectorConnectionInput(supabase, pipeline.source_id),
      getConnectorConnectionInput(supabase, pipeline.target_id),
    ]);

    const [sourceCols, targetCols] = await Promise.all([
      getColumns(sourceConn, pipeline.source_table),
      getColumns(targetConn, pipeline.target_table),
    ]);

    const mappings = mapSchemas(sourceCols, targetCols);

    const { error: delError } = await supabase.from('schema_mappings').delete().eq('pipeline_id', pipeline_id);
    if (delError) throw delError;

    let insertedMappings = [];
    if (mappings.length > 0) {
      const { data: inserted, error: insError } = await supabase
        .from('schema_mappings')
        .insert(mappings.map((m) => ({ ...m, pipeline_id })))
        .select('*');
      if (insError) throw insError;
      insertedMappings = inserted;
    }

    await logAudit(supabase, {
      action: 'schema.map',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Mapped ${mappings.length} columns for pipeline "${pipeline.name}"`,
      pipeline_id,
    });

    return NextResponse.json({ mappings: insertedMappings });
  } catch (error) {
    console.error('POST /api/schema/map failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to map schema') }, { status: 500 });
  }
}
