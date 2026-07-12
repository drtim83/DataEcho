import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase.from('profiles').select('id, email, role').eq('id', user.id).single();
    if (error) throw error;

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error('GET /api/profile failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load profile') }, { status: 500 });
  }
}
