import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { getConnectorConnectionInput } from './connector-helpers';
import { getColumns } from './db-schema';
import { runSync, MAX_SYNC_ROWS, type SyncResult, type AdditionalSourceInput, type CombineMode, type DestinationSyncInput, type FilterOperator, type MatchMode, type SyncMode } from './db-sync';
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

  const [{ data: extraSources }, { data: destinationRows }] = await Promise.all([
    supabase.from('pipeline_sources').select('id, source_id, source_table, combine_mode, join_type, join_column, primary_join_column').eq('pipeline_id', pipelineId),
    supabase.from('pipeline_destinations').select('id, target_id, target_table, filter_column, filter_operator, filter_value, match_mode, pipeline_destination_conditions(filter_column, filter_operator, filter_value)').eq('pipeline_id', pipelineId),
  ]);

  const startedAt = new Date().toISOString();

  let syncResult: SyncResult | undefined;
  let runError: string | undefined;
  try {
    const [sourceConn, targetConn] = await Promise.all([
      getConnectorConnectionInput(supabase, pipeline.source_id),
      getConnectorConnectionInput(supabase, pipeline.target_id),
    ]);

    const additionalSources: AdditionalSourceInput[] = await Promise.all(
      (extraSources ?? []).map(async (s) => ({
        source: await getConnectorConnectionInput(supabase, s.source_id),
        sourceTable: s.source_table as string,
        combineMode: (s.combine_mode as CombineMode) ?? 'union',
        joinType: s.join_type as 'inner' | 'left' | undefined,
        joinColumn: s.join_column as string | undefined,
        primaryJoinColumn: s.primary_join_column as string | undefined,
      }))
    );

    const destinations: DestinationSyncInput[] = await Promise.all(
      (destinationRows ?? []).map(async (d) => {
        const extraConditions = (d.pipeline_destination_conditions ?? []) as { filter_column: string; filter_operator: FilterOperator; filter_value: string }[];
        return {
          id: d.id as string,
          target: await getConnectorConnectionInput(supabase, d.target_id),
          targetTable: d.target_table as string,
          matchMode: (d.match_mode as MatchMode) ?? 'all',
          conditions: [
            { column: d.filter_column as string, operator: d.filter_operator as FilterOperator, value: d.filter_value as string },
            ...extraConditions.map((c) => ({ column: c.filter_column, operator: c.filter_operator, value: c.filter_value })),
          ],
        };
      })
    );

    syncResult = await runSync(
      sourceConn,
      pipeline.source_table,
      targetConn,
      pipeline.target_table,
      mappingRows as ColumnMapping[],
      (pipeline.sync_mode as SyncMode) ?? 'append',
      additionalSources,
      destinations
    );
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
    // Total across the primary target and every filtered destination — all of
    // it is real data that really moved, so all of it counts for cost/usage,
    // even though sync_runs.records stays scoped to the primary target.
    const totalRecords = syncResult.recordsLoaded + syncResult.destinationResults.reduce((s, d) => s + d.recordsLoaded, 0);
    const totalBytes = syncResult.bytesTransferred + syncResult.destinationResults.reduce((s, d) => s + d.bytesTransferred, 0);

    const computeMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const cost = computeCost(pipeline.direction, totalRecords, computeMs);
    const { error: meteringError } = await supabase.from('metering_events').insert({
      pipeline_id: pipelineId,
      direction: pipeline.direction,
      records: totalRecords,
      bytes: totalBytes,
      compute_ms: computeMs,
      cost_usd: cost,
    });
    if (meteringError) console.error('Failed to write metering event:', meteringError);

    await reportUsage(supabase, totalBytes);
  }

  const destinationSummary = syncResult && syncResult.destinationResults.length > 0
    ? ` + ${syncResult.destinationResults.reduce((s, d) => s + d.recordsLoaded, 0)} rows across ${syncResult.destinationResults.length} additional destination(s)`
    : '';

  await logAudit(supabase, {
    action: 'pipeline.run',
    actor: user.email ?? user.id,
    status: runError ? 'error' : 'success',
    details: runError
      ? `Sync failed for pipeline "${pipeline.name}": ${runError}`
      : `Synced ${syncResult?.recordsLoaded ?? 0} rows for pipeline "${pipeline.name}"${destinationSummary} (capped at ${MAX_SYNC_ROWS})`,
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

  const [sourceConn, targetConn, { data: joinSources }] = await Promise.all([
    getConnectorConnectionInput(supabase, pipeline.source_id),
    getConnectorConnectionInput(supabase, pipeline.target_id),
    supabase.from('pipeline_sources').select('source_id, source_table').eq('pipeline_id', pipelineId).eq('combine_mode', 'join'),
  ]);

  const [sourceCols, targetColsRaw, joinSourceCols] = await Promise.all([
    getColumns(sourceConn, pipeline.source_table),
    getColumns(targetConn, pipeline.target_table),
    Promise.all(
      (joinSources ?? []).map(async (s) => {
        const conn = await getConnectorConnectionInput(supabase, s.source_id);
        return getColumns(conn, s.source_table as string);
      })
    ).then((cols) => cols.flat()),
  ]);

  // A brand-new file-based target (e.g. an S3 object nothing has written to
  // yet) has no columns to introspect — there's no file-storage equivalent
  // of pre-declaring a table's schema via DDL. Mirror the source's shape in
  // that case, since the sync itself will define the target's real shape.
  const targetCols = targetColsRaw.length > 0 ? targetColsRaw : sourceCols;

  // Joined sources can contribute columns the primary source doesn't have
  // (e.g. a joined customers.name); the primary source's own columns take
  // priority on name conflicts, matching how the sync engine merges rows.
  const seenNames = new Set(sourceCols.map((c) => c.name));
  const combinedSourceCols = [
    ...sourceCols,
    ...joinSourceCols.filter((c) => {
      if (seenNames.has(c.name)) return false;
      seenNames.add(c.name);
      return true;
    }),
  ];

  const mappings = mapSchemas(combinedSourceCols, targetCols);

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
