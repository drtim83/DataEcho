import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase.from('profiles').select('id, email, role, created_at').order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ profiles: data });
  } catch (error) {
    console.error('GET /api/profiles failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load team') }, { status: 500 });
  }
}
