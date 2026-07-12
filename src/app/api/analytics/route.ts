import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { computeAnalytics } from '@/lib/analytics';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const analytics = await computeAnalytics(supabase);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('GET /api/analytics failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load analytics') }, { status: 500 });
  }
}
