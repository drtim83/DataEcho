import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

const FILTER_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'contains'];

// Additional destinations for a pipeline. Each gets a filtered subset of the
// same extracted+mapped rows (e.g. push customers where region = 'APAC' to a
// regional system) — see src/lib/db-sync.ts::runSync.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { data, error } = await supabase
      .from('pipeline_destinations')
      .select('*, connector:connectors(id, name, type, category, role, config, status), pipeline_destination_conditions(id, filter_column, filter_operator, filter_value)')
      .eq('pipeline_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ destinations: data });
  } catch (error) {
    console.error('GET /api/pipelines/[id]/destinations failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load destinations') }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
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

    const { data: pipeline } = await supabase.from('pipelines').select('name').eq('id', id).single();

    const { data, error } = await supabase
      .from('pipeline_destinations')
      .insert({ pipeline_id: id, target_id, target_table, filter_column, filter_operator, filter_value: String(filter_value), match_mode: match_mode || 'all' })
      .select('*, connector:connectors(id, name, type, category, role, config, status), pipeline_destination_conditions(id, filter_column, filter_operator, filter_value)')
      .single();

    if (error) throw error;

    await logAudit(supabase, {
      action: 'pipeline.destination.add',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Added a filtered destination (${target_table} where ${filter_column} ${filter_operator} ${filter_value}) to pipeline "${pipeline?.name ?? id}"`,
      pipeline_id: id,
    });

    return NextResponse.json({ destination: data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/pipelines/[id]/destinations failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to add destination') }, { status: 500 });
  }
}
