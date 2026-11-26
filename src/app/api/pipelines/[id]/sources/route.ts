import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';
import { sanitizeConnectorConfig } from '@/lib/firebase/db-helpers';
import { logAudit } from '@/lib/audit';

// Additional sources for a pipeline, combined with the primary source via
// UNION ALL or JOIN when the pipeline runs. See src/lib/db-sync.ts::runSync.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const sourcesSnap = await db
      .collection('pipeline_sources')
      .where('pipeline_id', '==', id)
      .get();

    const rawSources = sourcesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string })
      .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));

    const connectorIds = [...new Set(rawSources.map((s) => s.source_id as string).filter(Boolean))];
    const connectorDocs = await Promise.all(
      connectorIds.map((cid) => db.collection('connectors').doc(cid).get())
    );
    const connectorById = new Map(
      connectorDocs
        .filter((d) => d.exists)
        .map((d) => {
          const c = d.data()!;
          return [
            d.id,
            {
              id: d.id,
              name: c.name,
              type: c.type,
              category: c.category,
              role: c.role,
              config: sanitizeConnectorConfig(c.config as Record<string, unknown> | undefined),
              status: c.status,
            },
          ];
        })
    );

    const sources = rawSources.map((s) => ({
      ...s,
      connector: connectorById.get(s.source_id as string) ?? null,
    }));

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('GET /api/pipelines/[id]/sources failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load sources') }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireUser();
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

    const [pipelineSnap, connectorSnap] = await Promise.all([
      db.collection('pipelines').doc(id).get(),
      db.collection('connectors').doc(source_id).get(),
    ]);
    const pipelineName = pipelineSnap.exists ? (pipelineSnap.data()?.name as string | undefined) : undefined;

    const docData = {
      pipeline_id: id,
      source_id,
      source_table,
      combine_mode: combine_mode || 'union',
      join_type: join_type || 'inner',
      join_column: combine_mode === 'join' ? join_column : null,
      primary_join_column: combine_mode === 'join' ? primary_join_column : null,
      created_at: new Date().toISOString(),
    };

    const ref = await db.collection('pipeline_sources').add(docData);
    const c = connectorSnap.exists ? connectorSnap.data()! : null;
    const source = {
      id: ref.id,
      ...docData,
      connector: c
        ? {
            id: connectorSnap.id,
            name: c.name,
            type: c.type,
            category: c.category,
            role: c.role,
            config: sanitizeConnectorConfig(c.config as Record<string, unknown> | undefined),
            status: c.status,
          }
        : null,
    };

    const modeSummary = combine_mode === 'join' ? `joined on ${primary_join_column} = ${join_column} (${join_type || 'inner'})` : 'unioned';

    await logAudit(db, {
      action: 'pipeline.source.add',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Added an additional source (${source_table}, ${modeSummary}) to pipeline "${pipelineName ?? id}"`,
      pipeline_id: id,
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    console.error('POST /api/pipelines/[id]/sources failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to add source') }, { status: 500 });
  }
}
