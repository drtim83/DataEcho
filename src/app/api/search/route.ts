import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';

export async function GET(req: Request) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase() || '';
    if (q.length < 2) return NextResponse.json({ connectors: [], pipelines: [] });

    const [connectorsSnap, pipelinesSnap] = await Promise.all([
      db.collection('connectors').get(),
      db.collection('pipelines').get(),
    ]);

    const connectors = connectorsSnap.docs
      .map((d) => {
        const c = d.data();
        return {
          id: d.id,
          name: String(c.name ?? ''),
          type: c.type,
          host: (c.config as { host?: string } | undefined)?.host,
        };
      })
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 5);

    const pipelines = pipelinesSnap.docs
      .map((d) => {
        const p = d.data();
        return {
          id: d.id,
          name: String(p.name ?? ''),
          source_table: p.source_table as string | undefined,
          target_table: p.target_table as string | undefined,
        };
      })
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.source_table ?? '').toLowerCase().includes(q) ||
          (p.target_table ?? '').toLowerCase().includes(q)
      )
      .slice(0, 5);

    return NextResponse.json({ connectors, pipelines });
  } catch (error) {
    console.error('GET /api/search failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Search failed') }, { status: 500 });
  }
}
