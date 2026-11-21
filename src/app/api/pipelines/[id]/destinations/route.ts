import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';
import { sanitizeConnectorConfig } from '@/lib/firebase/db-helpers';
import { logAudit } from '@/lib/audit';

const FILTER_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'contains'];

// Additional destinations for a pipeline. Each gets a filtered subset of the
// same extracted+mapped rows (e.g. push customers where region = 'APAC' to a
// regional system) — see src/lib/db-sync.ts::runSync.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const destsSnap = await db
      .collection('pipeline_destinations')
      .where('pipeline_id', '==', id)
      .get();

    const rawDests = destsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string })
      .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));

    const connectorIds = [...new Set(rawDests.map((d) => d.target_id as string).filter(Boolean))];
    const [connectorDocs, conditionSnaps] = await Promise.all([
      Promise.all(connectorIds.map((cid) => db.collection('connectors').doc(cid).get())),
      Promise.all(
        rawDests.map((dest) =>
          db
            .collection('pipeline_destination_conditions')
            .where('destination_id', '==', dest.id)
            .get()
        )
      ),
    ]);

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

    const destinations = rawDests.map((dest, idx) => ({
      ...dest,
      connector: connectorById.get(dest.target_id as string) ?? null,
      pipeline_destination_conditions: conditionSnaps[idx].docs.map((c) => {
        const cd = c.data();
        return {
          id: c.id,
          filter_column: cd.filter_column,
          filter_operator: cd.filter_operator,
          filter_value: cd.filter_value,
        };
      }),
    }));

    return NextResponse.json({ destinations });
  } catch (error) {
    console.error('GET /api/pipelines/[id]/destinations failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load destinations') }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { target_id, target_table, filter_column, filter_operator, filter_value, match_mode } = body;

    if (!target_id || !target_table || !filter_column || !filter_operator || filter_value === undefined || filter_value === '') {
      return NextResponse.json({ error: 'target_id, target_table, filter_column, filter_operator, and filter_value are required' }, { status: 400 });
    }
    if (!FILTER_OPERATORS.includes(filter_operator)) {
      return NextResponse.json({ error: `filter_operator must be one of: ${FILTER_OPERATORS.join(', ')}` }, { status: 400 });
    }
    if (match_mode && !['all', 'any'].includes(match_mode)) {
      return NextResponse.json({ error: 'match_mode must be "all" or "any"' }, { status: 400 });
    }

    const [pipelineSnap, connectorSnap] = await Promise.all([
      db.collection('pipelines').doc(id).get(),
      db.collection('connectors').doc(target_id).get(),
    ]);
    const pipelineName = pipelineSnap.exists ? (pipelineSnap.data()?.name as string | undefined) : undefined;

    const docData = {
      pipeline_id: id,
      target_id,
      target_table,
      filter_column,
      filter_operator,
      filter_value: String(filter_value),
      match_mode: match_mode || 'all',
      created_at: new Date().toISOString(),
    };

    const ref = await db.collection('pipeline_destinations').add(docData);
    const c = connectorSnap.exists ? connectorSnap.data()! : null;
    const destination = {
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
      pipeline_destination_conditions: [],
    };

    await logAudit(db, {
      action: 'pipeline.destination.add',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Added a filtered destination (${target_table} where ${filter_column} ${filter_operator} ${filter_value}) to pipeline "${pipelineName ?? id}"`,
      pipeline_id: id,
    });

    return NextResponse.json({ destination }, { status: 201 });
  } catch (error) {
    console.error('POST /api/pipelines/[id]/destinations failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to add destination') }, { status: 500 });
  }
}
