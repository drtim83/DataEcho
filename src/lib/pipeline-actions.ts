import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { getConnectorConnectionInput } from './connector-helpers';
import { getColumns } from './db-schema';
import { runSync, MAX_SYNC_ROWS, type SyncResult } from './db-sync';
import { mapSchemas, type ColumnMapping } from './schema-mapper';
import { computeCost } from './pricing';
import { reportUsage } from './billing-helpers';
import { logAudit } from './audit';
import { errorMessage } from './supabase/server';

export class PipelineActionError extends Error {}

// Shared by the /api/pipelines/[id]/run route and the MCP trigger_sync tool
// so both surfaces execute the exact same real sync, not two divergent copies.
export async function runPipelineSync(supabase: SupabaseClient, user: User, pipelineId: string) {
  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipelines')
    .select('*')
    .eq('id', pipelineId)
    .single();

  if (pipelineError || !pipeline) {
    throw new PipelineActionError('Pipeline not found');
  }
  if (!pipeline.source_table || !pipeline.target_table) {
    throw new PipelineActionError('Pipeline is missing a source or target table');
  }

  const { data: mappingRows, error: mappingError } = await supabase
    .from('schema_mappings')
    .select('source_col, target_col, source_type, target_type, ai_confidence, ai_warning')
    .eq('pipeline_id', pipelineId);

  if (mappingError) throw mappingError;
  if (!mappingRows || mappingRows.length === 0) {
    throw new PipelineActionError('No schema mapping exists for this pipeline yet. Map the schema before running.');
  }

  const startedAt = new Date().toISOString();

  let syncResult: SyncResult | undefined;
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
      pipeline_id: pipelineId,
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

  await supabase.from('pipelines').update({ status: runError ? 'error' : 'active' }).eq('id', pipelineId);

  if (!runError && syncResult) {
    const computeMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const cost = computeCost(pipeline.direction, syncResult.recordsLoaded, computeMs);
    const { error: meteringError } = await supabase.from('metering_events').insert({
      pipeline_id: pipelineId,
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
    pipeline_id: pipelineId,
    records_affected: syncResult?.recordsLoaded,
  });

  return { run, syncResult, runError, pipelineName: pipeline.name as string };
}

// Shared by the /api/schema/map route and the MCP map_schema tool.
export async function runSchemaMapping(supabase: SupabaseClient, user: User, pipelineId: string) {
  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipelines')
    .select('source_id, target_id, source_table, target_table, name')
    .eq('id', pipelineId)
    .single();

  if (pipelineError || !pipeline) {
    throw new PipelineActionError('Pipeline not found');
  }
  if (!pipeline.source_table || !pipeline.target_table) {
    throw new PipelineActionError('Pipeline is missing a source or target table');
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

  const { error: delError } = await supabase.from('schema_mappings').delete().eq('pipeline_id', pipelineId);
  if (delError) throw delError;

  let insertedMappings: ColumnMapping[] = [];
  if (mappings.length > 0) {
    const { data: inserted, error: insError } = await supabase
      .from('schema_mappings')
      .insert(mappings.map((m) => ({ ...m, pipeline_id: pipelineId })))
      .select('*');
    if (insError) throw insError;
    insertedMappings = inserted;
  }

  await logAudit(supabase, {
    action: 'schema.map',
    actor: user.email ?? user.id,
    status: 'success',
    details: `Mapped ${mappings.length} columns for pipeline "${pipeline.name}"`,
    pipeline_id: pipelineId,
  });

  return { mappings: insertedMappings, pipelineName: pipeline.name as string };
}
