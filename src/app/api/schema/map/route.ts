import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';
import { runSchemaMapping, PipelineActionError } from '@/lib/pipeline-actions';

export async function GET(req: Request) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pipelineId = new URL(req.url).searchParams.get('pipeline_id');
    if (!pipelineId) return NextResponse.json({ error: 'pipeline_id is required' }, { status: 400 });

    const snap = await db
      .collection('schema_mappings')
      .where('pipeline_id', '==', pipelineId)
      .get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ mappings: data });
  } catch (error) {
    console.error('GET /api/schema/map failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load mappings') }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { pipeline_id } = await req.json();
    if (!pipeline_id) return NextResponse.json({ error: 'pipeline_id is required' }, { status: 400 });

    const { mappings } = await runSchemaMapping(db, user, pipeline_id);

    return NextResponse.json({ mappings });
  } catch (error) {
    if (error instanceof PipelineActionError) {
      const status = error.message === 'Pipeline not found' ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('POST /api/schema/map failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to map schema') }, { status: 500 });
  }
}
