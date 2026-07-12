import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [{ data: runs, error: runsError }, { data: pipelines, error: pipelinesError }] = await Promise.all([
      supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(50),
      supabase.from('pipelines').select('id, name, direction'),
    ]);

    if (runsError) throw runsError;
    if (pipelinesError) throw pipelinesError;

    const pipelineById = new Map((pipelines || []).map((p) => [p.id, p]));
    const enriched = (runs || []).map((r) => ({ ...r, pipeline: pipelineById.get(r.pipeline_id) }));

    return NextResponse.json({ runs: enriched });
  } catch (error) {
    console.error('GET /api/sync-runs failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load sync runs') }, { status: 500 });
  }
}
