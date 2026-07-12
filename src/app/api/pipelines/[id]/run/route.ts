import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { getConnectorConnectionInput } from '@/lib/connector-helpers';
import { runSync, MAX_SYNC_ROWS } from '@/lib/db-sync';
import { computeCost } from '@/lib/pricing';
import { reportUsage } from '@/lib/billing-helpers';
import { logAudit } from '@/lib/audit';
import type { ColumnMapping } from '@/lib/schema-mapper';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', id)
      .single();

    if (pipelineError || !pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }
    if (!pipeline.source_table || !pipeline.target_table) {
      return NextResponse.json({ error: 'Pipeline is missing a source or target table' }, { status: 400 });
    }

    const { data: mappingRows, error: mappingError } = await supabase
      .from('schema_mappings')
      .select('source_col, target_col, source_type, target_type, ai_confidence, ai_warning')
      .eq('pipeline_id', id);

    if (mappingError) throw mappingError;
    if (!mappingRows || mappingRows.length === 0) {
      return NextResponse.json({ error: 'No schema mapping exists for this pipeline yet. Map the schema before running.' }, { status: 400 });
    }

    const startedAt = new Date().toISOString();

    let syncResult;
    let runError: string | undefined;
    try {
      const [sourceConn, targetConn] = await Promise.all([
        getConnectorConnectionInput(supabase, pipeline.source_id),
        getConnectorConnectionInput(supabase, pipeline.target_id),
      ]);
      syncResult = await runSync(sourceConn, pipeline.source_table, targetConn, pipeline.target_table, mappingRows as ColumnMapping[]);
    } catch (err) {
      runError = errorMessage(err, 'Sync failed');
    }

    const completedAt = new Date().toISOString();
    const status = runError ? 'failed' : 'completed';

    const { data: run, error: insertRunError } = await supabase
      .from('sync_runs')
      .insert({
        pipeline_id: id,
        direction: pipeline.direction,
        status,
        records: syncResult?.recordsLoaded ?? 0,
        started_at: startedAt,
        completed_at: completedAt,
        error: runError,
      })
      .select('*')
      .single();

    if (insertRunError) throw insertRunError;

    await supabase.from('pipelines').update({ status: runError ? 'error' : 'active' }).eq('id', id);

    if (!runError && syncResult) {
      const computeMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
      const cost = computeCost(pipeline.direction, syncResult.recordsLoaded, computeMs);
      const { error: meteringError } = await supabase.from('metering_events').insert({
        pipeline_id: id,
        direction: pipeline.direction,
        records: syncResult.recordsLoaded,
        bytes: syncResult.bytesTransferred,
        compute_ms: computeMs,
        cost_usd: cost,
      });
      if (meteringError) console.error('Failed to write metering event:', meteringError);

      await reportUsage(supabase, syncResult.bytesTransferred);
    }

    await logAudit(supabase, {
      action: 'pipeline.run',
      actor: user.email ?? user.id,
      status: runError ? 'error' : 'success',
      details: runError
        ? `Sync failed for pipeline "${pipeline.name}": ${runError}`
        : `Synced ${syncResult?.recordsLoaded ?? 0} rows for pipeline "${pipeline.name}" (capped at ${MAX_SYNC_ROWS})`,
      pipeline_id: id,
      records_affected: syncResult?.recordsLoaded,
    });

    if (runError) {
      return NextResponse.json({ error: runError, run }, { status: 500 });
    }

    return NextResponse.json({ run, ...syncResult });
  } catch (error) {
    console.error('POST /api/pipelines/[id]/run failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to run pipeline') }, { status: 500 });
  }
}
