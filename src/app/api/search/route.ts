import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const q = new URL(req.url).searchParams.get('q')?.trim() || '';
    if (q.length < 2) return NextResponse.json({ connectors: [], pipelines: [] });

    const pattern = `%${q}%`;

    const [{ data: connectors, error: connectorsError }, { data: pipelines, error: pipelinesError }] = await Promise.all([
      supabase
        .from('connectors')
        .select('id, name, type, config')
        .or(`name.ilike.${pattern}`)
        .limit(5),
      supabase
        .from('pipelines')
        .select('id, name, source_table, target_table')
        .or(`name.ilike.${pattern},source_table.ilike.${pattern},target_table.ilike.${pattern}`)
        .limit(5),
    ]);

    if (connectorsError) throw connectorsError;
    if (pipelinesError) throw pipelinesError;

    return NextResponse.json({
      connectors: (connectors || []).map((c) => ({ id: c.id, name: c.name, type: c.type, host: (c.config as { host?: string })?.host })),
      pipelines: (pipelines || []).map((p) => ({ id: p.id, name: p.name, source_table: p.source_table, target_table: p.target_table })),
    });
  } catch (error) {
    console.error('GET /api/search failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Search failed') }, { status: 500 });
  }
}
