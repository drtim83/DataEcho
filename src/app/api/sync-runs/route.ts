import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';

export async function GET() {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [runsSnap, pipelinesSnap] = await Promise.all([
      db.collection('sync_runs').orderBy('started_at', 'desc').limit(50).get(),
      db.collection('pipelines').get(),
    ]);

    const pipelineById = new Map(
      pipelinesSnap.docs.map((d) => {
        const p = d.data();
        return [d.id, { id: d.id, name: p.name as string, direction: p.direction as string }];
      })
    );

    const enriched = runsSnap.docs.map((d) => {
      const r = d.data();
      return {
        id: d.id,
        ...r,
        pipeline: pipelineById.get(r.pipeline_id as string),
      };
    });

    return NextResponse.json({ runs: enriched });
  } catch (error) {
    console.error('GET /api/sync-runs failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load sync runs') }, { status: 500 });
  }
}
