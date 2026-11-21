import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/firebase/server';

export async function GET() {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Lightweight read-only query to verify Cloud Firestore connectivity and access.
    const countSnap = await db.collection('connectors').count().get();
    const count = countSnap.data().count;

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to DataEcho Cloud Firestore!',
      details: `Live connection verified. Found ${count || 0} configured connectors.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      },
      { status: 500 }
    );
  }
}
