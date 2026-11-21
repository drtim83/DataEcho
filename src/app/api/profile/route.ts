import { NextResponse } from 'next/server';
import { ensureUserProfile, requireUser, errorMessage } from '@/lib/firebase/server';

export async function GET() {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await ensureUserProfile(db, user);

    return NextResponse.json({
      profile: { id: profile.id, email: profile.email, role: profile.role },
    });
  } catch (error) {
    console.error('GET /api/profile failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load profile') }, { status: 500 });
  }
}
