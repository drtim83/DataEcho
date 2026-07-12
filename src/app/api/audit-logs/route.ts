import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requested = Number(new URL(req.url).searchParams.get('limit'));
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 200) : 200;

    const [{ data: logs, error: logsError }, { data: pipelines, error: pipelinesError }] = await Promise.all([
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(limit),
      supabase.from('pipelines').select('id, name, direction'),
    ]);

    if (logsError) throw logsError;
    if (pipelinesError) throw pipelinesError;

    const pipelineById = new Map((pipelines || []).map((p) => [p.id, p]));
    const enriched = (logs || []).map((log) => {
      const pipeline = log.pipeline_id ? pipelineById.get(log.pipeline_id) : undefined;
      return {
        ...log,
        pipeline_name: pipeline?.name,
        direction: log.direction ?? pipeline?.direction,
      };
    });

    return NextResponse.json({ logs: enriched });
  } catch (error) {
    console.error('GET /api/audit-logs failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load audit logs') }, { status: 500 });
  }
}
