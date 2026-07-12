import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

const FILTER_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'contains'];

// Extra filter conditions beyond a destination's primary one (migration 012).
// Combined per the destination's match_mode: 'all' (AND) or 'any' (OR).
export async function POST(req: Request, { params }: { params: Promise<{ id: string; destId: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { destId } = await params;
    const body = await req.json();
    const { filter_column, filter_operator, filter_value } = body;

    if (!filter_column || !filter_operator || filter_value === undefined || filter_value === '') {
      return NextResponse.json({ error: 'filter_column, filter_operator, and filter_value are required' }, { status: 400 });
    }
    if (!FILTER_OPERATORS.includes(filter_operator)) {
      return NextResponse.json({ error: `filter_operator must be one of: ${FILTER_OPERATORS.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pipeline_destination_conditions')
      .insert({ destination_id: destId, filter_column, filter_operator, filter_value: String(filter_value) })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ condition: data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/pipelines/[id]/destinations/[destId]/conditions failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to add condition') }, { status: 500 });
  }
}
