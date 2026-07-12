import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
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
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [{ data: pipelines, error: pipelinesError }, { data: connectors, error: connectorsError }, { data: runs, error: runsError }] = await Promise.all([
      supabase.from('pipelines').select('*').order('created_at', { ascending: false }),
      supabase.from('connectors').select('id, name, type, category, role, config, status'),
      supabase.from('sync_runs').select('pipeline_id, records, started_at').order('started_at', { ascending: false }),
    ]);

    if (pipelinesError) throw pipelinesError;
    if (connectorsError) throw connectorsError;
    if (runsError) throw runsError;

    const connectorById = new Map((connectors as ConnectorRow[]).map((c) => [c.id, c]));

    const result: (Pipeline & { source_table?: string; target_table?: string })[] = (pipelines as PipelineRow[]).map((p) => {
      const pipelineRuns = (runs || []).filter((r) => r.pipeline_id === p.id);
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
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, source_connector_id, target_connector_id, source_table, target_table, direction, sync_mode } = body;

    if (!name || !source_connector_id || !target_connector_id || !source_table || !target_table) {
      return NextResponse.json({ error: 'name, source/target connector, and source/target table are required' }, { status: 400 });
    }
    if (sync_mode && !['append', 'truncate_reload'].includes(sync_mode)) {
      return NextResponse.json({ error: 'sync_mode must be "append" or "truncate_reload"' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pipelines')
      .insert({
        name,
        source_id: source_connector_id,
        target_id: target_connector_id,
        source_table,
        target_table,
        direction: direction || 'cloud_bound',
        sync_mode: sync_mode || 'append',
        status: 'draft',
      })
      .select('*')
      .single();

    if (error) throw error;

    await logAudit(supabase, {
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
