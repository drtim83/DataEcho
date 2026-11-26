import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';

export async function GET() {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const snap = await db.collection('profiles').orderBy('created_at', 'asc').get();
    const profiles = snap.docs.map((d) => {
      const p = d.data();
      return {
        id: d.id,
        email: p.email as string,
        role: p.role as 'admin' | 'user',
        created_at: p.created_at as string,
      };
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('GET /api/profiles failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load team') }, { status: 500 });
  }
}
