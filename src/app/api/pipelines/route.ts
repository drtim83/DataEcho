import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';
import { logAudit } from '@/lib/audit';
import type { Connector, Pipeline, PipelineDirection, SyncMode } from '@/types';

interface PipelineRow {
  id: string;
  name: string;
  source_id: string;
  target_id: string;
  source_table: string | null;
  target_table: string | null;
  direction: PipelineDirection;
  status: string;
  sync_mode: SyncMode;
  created_at: string;
}

interface ConnectorRow {
  id: string;
  name: string;
  type: Connector['type'];
  category: Connector['category'];
  role: Connector['role'];
  config: { host?: string; port?: number; database?: string };
  status: string;
}

function toConnectorSummary(row?: ConnectorRow): Connector | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    category: row.category,
    role: row.role,
    host: row.config?.host,
    port: row.config?.port,
    database: row.config?.database,
    status: row.status as Connector['status'],
    tables_count: 0,
    last_accessed: '',
    created_at: '',
  };
}

export async function GET() {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [pipelinesSnap, connectorsSnap, runsSnap] = await Promise.all([
      db.collection('pipelines').orderBy('created_at', 'desc').get(),
      db.collection('connectors').get(),
      db.collection('sync_runs').orderBy('started_at', 'desc').get(),
    ]);

    const pipelines: PipelineRow[] = pipelinesSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PipelineRow, 'id'>),
    }));
    const connectors: ConnectorRow[] = connectorsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ConnectorRow, 'id'>),
    }));
    const runs = runsSnap.docs.map((d) => d.data() as { pipeline_id: string; records?: number; started_at: string });

    const connectorById = new Map(connectors.map((c) => [c.id, c]));

    const result: (Pipeline & { source_table?: string; target_table?: string })[] = pipelines.map((p) => {
      const pipelineRuns = runs.filter((r) => r.pipeline_id === p.id);
      const records_synced = pipelineRuns.reduce((sum, r) => sum + (r.records || 0), 0);
      const last_sync = pipelineRuns[0]?.started_at;

      return {
        id: p.id,
        name: p.name,
        source_connector_id: p.source_id,
        target_connector_id: p.target_id,
        source_connector: toConnectorSummary(connectorById.get(p.source_id)),
        target_connector: toConnectorSummary(connectorById.get(p.target_id)),
        source_table: p.source_table ?? undefined,
        target_table: p.target_table ?? undefined,
        direction: p.direction,
        status: p.status as Pipeline['status'],
        sync_mode: p.sync_mode ?? 'append',
        last_sync,
        records_synced,
        created_at: p.created_at,
      };
    });

    return NextResponse.json({ pipelines: result });
  } catch (error) {
    console.error('GET /api/pipelines failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load pipelines') }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, source_connector_id, target_connector_id, source_table, target_table, direction, sync_mode } = body;

    if (!name || !source_connector_id || !target_connector_id || !source_table || !target_table) {
      return NextResponse.json({ error: 'name, source/target connector, and source/target table are required' }, { status: 400 });
    }
    if (sync_mode && !['append', 'truncate_reload'].includes(sync_mode)) {
      return NextResponse.json({ error: 'sync_mode must be "append" or "truncate_reload"' }, { status: 400 });
    }

    const docData = {
      name,
      source_id: source_connector_id,
      target_id: target_connector_id,
      source_table,
      target_table,
      direction: direction || 'cloud_bound',
      sync_mode: sync_mode || 'append',
      status: 'draft',
      created_at: new Date().toISOString(),
    };

    const ref = await db.collection('pipelines').add(docData);
    const data = { id: ref.id, ...docData };

    await logAudit(db, {
      action: 'pipeline.create',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Created pipeline "${name}" (${source_table} → ${target_table})`,
      pipeline_id: data.id,
    });

    return NextResponse.json({ pipeline: data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/pipelines failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to create pipeline') }, { status: 500 });
  }
}
