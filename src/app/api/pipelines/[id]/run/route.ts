import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { runPipelineSync, PipelineActionError } from '@/lib/pipeline-actions';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { run, syncResult, runError } = await runPipelineSync(supabase, user, id);

    if (runError) {
      return NextResponse.json({ error: runError, run }, { status: 500 });
    }

    return NextResponse.json({ run, ...syncResult });
  } catch (error) {
    if (error instanceof PipelineActionError) {
      const status = error.message === 'Pipeline not found' ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('POST /api/pipelines/[id]/run failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to run pipeline') }, { status: 500 });
  }
}
