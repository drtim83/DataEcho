import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';

export async function GET(req: Request) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requested = Number(new URL(req.url).searchParams.get('limit'));
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 200) : 200;

    const [logsSnap, pipelinesSnap] = await Promise.all([
      db.collection('audit_logs').orderBy('timestamp', 'desc').limit(limit).get(),
      db.collection('pipelines').get(),
    ]);

    const pipelineById = new Map(
      pipelinesSnap.docs.map((d) => {
        const p = d.data();
        return [d.id, { id: d.id, name: p.name as string, direction: p.direction as string }];
      })
    );

    const enriched = logsSnap.docs.map((d) => {
      const log = d.data();
      const pipeline = log.pipeline_id ? pipelineById.get(log.pipeline_id as string) : undefined;
      return {
        id: d.id,
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
