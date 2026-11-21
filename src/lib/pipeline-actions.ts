import type { Firestore } from 'firebase-admin/firestore';
import { getConnectorConnectionInput } from './connector-helpers';
import { getColumns } from './db-schema';
import {
  runSync,
  MAX_SYNC_ROWS,
  type SyncResult,
  type AdditionalSourceInput,
  type CombineMode,
  type DestinationSyncInput,
  type FilterOperator,
  type MatchMode,
  type SyncMode,
} from './db-sync';
import { mapSchemas, type ColumnMapping } from './schema-mapper';
import { computeCost } from './pricing';
import { reportUsage } from './billing-helpers';
import { logAudit } from './audit';
import { errorMessage, type AppUser } from './firebase/server';
import { commitDeletes } from './firebase/db-helpers';
import type { PipelineDirection } from '@/types';

export class PipelineActionError extends Error {}

// Shared by the /api/pipelines/[id]/run route and the MCP trigger_sync tool
// so both surfaces execute the exact same real sync, not two divergent copies.
export async function runPipelineSync(
  db: Firestore,
  user: AppUser,
  pipelineId: string
) {
  const pipelineSnap = await db.collection('pipelines').doc(pipelineId).get();

  if (!pipelineSnap.exists) {
    throw new PipelineActionError('Pipeline not found');
  }

  const pipeline = pipelineSnap.data()!;
  if (!pipeline.source_table || !pipeline.target_table) {
    throw new PipelineActionError('Pipeline is missing a source or target table');
  }

  const mappingSnap = await db
    .collection('schema_mappings')
    .where('pipeline_id', '==', pipelineId)
    .get();

  if (mappingSnap.empty) {
    throw new PipelineActionError(
      'No schema mapping exists for this pipeline yet. Map the schema before running.'
    );
  }

  const mappingRows = mappingSnap.docs.map((d) => {
    const m = d.data();
    return {
      source_col: m.source_col as string,
      target_col: m.target_col as string,
      source_type: m.source_type as string,
      target_type: m.target_type as string,
      ai_confidence: m.ai_confidence as number,
      ai_warning: m.ai_warning as string | undefined,
    };
  });

  const [extraSourcesSnap, destinationsSnap] = await Promise.all([
    db.collection('pipeline_sources').where('pipeline_id', '==', pipelineId).get(),
    db.collection('pipeline_destinations').where('pipeline_id', '==', pipelineId).get(),
  ]);

  const startedAt = new Date().toISOString();

  let syncResult: SyncResult | undefined;
  let runError: string | undefined;
  try {
    const [sourceConn, targetConn] = await Promise.all([
      getConnectorConnectionInput(db, pipeline.source_id as string),
      getConnectorConnectionInput(db, pipeline.target_id as string),
    ]);

    const additionalSources: AdditionalSourceInput[] = await Promise.all(
      extraSourcesSnap.docs.map(async (docSnap) => {
        const s = docSnap.data();
        return {
          source: await getConnectorConnectionInput(db, s.source_id as string),
          sourceTable: s.source_table as string,
          combineMode: (s.combine_mode as CombineMode) ?? 'union',
          joinType: s.join_type as 'inner' | 'left' | undefined,
          joinColumn: s.join_column as string | undefined,
          primaryJoinColumn: s.primary_join_column as string | undefined,
        };
      })
    );

    const destinations: DestinationSyncInput[] = await Promise.all(
      destinationsSnap.docs.map(async (destSnap) => {
        const d = destSnap.data();
        const condSnap = await db
          .collection('pipeline_destination_conditions')
          .where('destination_id', '==', destSnap.id)
          .get();

        const extraConditions = condSnap.docs.map((c) => c.data()) as {
          filter_column: string;
          filter_operator: FilterOperator;
          filter_value: string;
        }[];

        return {
          id: destSnap.id,
          target: await getConnectorConnectionInput(db, d.target_id as string),
          targetTable: d.target_table as string,
          matchMode: (d.match_mode as MatchMode) ?? 'all',
          conditions: [
            {
              column: d.filter_column as string,
              operator: d.filter_operator as FilterOperator,
              value: d.filter_value as string,
            },
            ...extraConditions.map((c) => ({
              column: c.filter_column,
              operator: c.filter_operator,
              value: c.filter_value,
            })),
          ],
        };
      })
    );

    syncResult = await runSync(
      sourceConn,
      pipeline.source_table as string,
      targetConn,
      pipeline.target_table as string,
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

  const runData = {
    pipeline_id: pipelineId,
    direction: pipeline.direction as string,
    status,
    records: syncResult?.recordsLoaded ?? 0,
    started_at: startedAt,
    completed_at: completedAt,
    error: runError ?? null,
  };
  const runRef = await db.collection('sync_runs').add(runData);
  const run = { id: runRef.id, ...runData };

  await db
    .collection('pipelines')
    .doc(pipelineId)
    .update({ status: runError ? 'error' : 'active' });

  if (!runError && syncResult) {
    // Total across the primary target and every filtered destination — all of
    // it is real data that really moved, so all of it counts for cost/usage,
    // even though sync_runs.records stays scoped to the primary target.
    const totalRecords =
      syncResult.recordsLoaded +
      syncResult.destinationResults.reduce((s, d) => s + d.recordsLoaded, 0);
    const totalBytes =
      syncResult.bytesTransferred +
      syncResult.destinationResults.reduce((s, d) => s + d.bytesTransferred, 0);

    const computeMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const cost = computeCost(
      pipeline.direction as PipelineDirection,
      totalRecords,
      computeMs
    );
    try {
      await db.collection('metering_events').add({
        pipeline_id: pipelineId,
        direction: pipeline.direction as string,
        records: totalRecords,
        bytes: totalBytes,
        compute_ms: computeMs,
        cost_usd: cost,
        timestamp: completedAt,
      });
    } catch (meteringError) {
      console.error('Failed to write metering event:', meteringError);
    }

    await reportUsage(db, totalBytes);
  }

  const destinationSummary =
    syncResult && syncResult.destinationResults.length > 0
      ? ` + ${syncResult.destinationResults.reduce((s, d) => s + d.recordsLoaded, 0)} rows across ${syncResult.destinationResults.length} additional destination(s)`
      : '';

  await logAudit(db, {
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
export async function runSchemaMapping(
  db: Firestore,
  user: AppUser,
  pipelineId: string
) {
  const pipelineSnap = await db.collection('pipelines').doc(pipelineId).get();

  if (!pipelineSnap.exists) {
    throw new PipelineActionError('Pipeline not found');
  }
  const pipeline = pipelineSnap.data()!;
  if (!pipeline.source_table || !pipeline.target_table) {
    throw new PipelineActionError('Pipeline is missing a source or target table');
  }

  const [sourceConn, targetConn, extraSourcesSnap] = await Promise.all([
    getConnectorConnectionInput(db, pipeline.source_id as string),
    getConnectorConnectionInput(db, pipeline.target_id as string),
    db.collection('pipeline_sources').where('pipeline_id', '==', pipelineId).get(),
  ]);

  const joinSources = extraSourcesSnap.docs
    .map((d) => d.data())
    .filter((s) => s.combine_mode === 'join');

  const [sourceCols, targetColsRaw, joinSourceCols] = await Promise.all([
    getColumns(sourceConn, pipeline.source_table as string),
    getColumns(targetConn, pipeline.target_table as string),
    Promise.all(
      joinSources.map(async (s) => {
        const conn = await getConnectorConnectionInput(db, s.source_id as string);
        return getColumns(conn, s.source_table as string);
      })
    ).then((cols) => cols.flat()),
  ]);

  const targetCols = targetColsRaw.length > 0 ? targetColsRaw : sourceCols;

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

  const existingSnap = await db
    .collection('schema_mappings')
    .where('pipeline_id', '==', pipelineId)
    .get();
  if (!existingSnap.empty) {
    await commitDeletes(
      db,
      existingSnap.docs.map((d) => d.ref)
    );
  }

  const insertedMappings: (ColumnMapping & { id: string; pipeline_id: string })[] = [];
  if (mappings.length > 0) {
    for (let i = 0; i < mappings.length; i += 450) {
      const chunk = mappings.slice(i, i + 450);
      const batch = db.batch();
      for (const m of chunk) {
        const ref = db.collection('schema_mappings').doc();
        const record = { ...m, pipeline_id: pipelineId };
        batch.set(ref, record);
        insertedMappings.push({ id: ref.id, ...record });
      }
      await batch.commit();
    }
  }

  await logAudit(db, {
    action: 'schema.map',
    actor: user.email ?? user.id,
    status: 'success',
    details: `Mapped ${mappings.length} columns for pipeline "${pipeline.name}"`,
    pipeline_id: pipelineId,
  });

  return { mappings: insertedMappings, pipelineName: pipeline.name as string };
}
