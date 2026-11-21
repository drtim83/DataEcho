import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';

export async function GET() {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const snap = await db.collection('billing_accounts').get();
    const latest = snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))[0];

    const billing = latest
      ? {
          card_brand: latest.card_brand ?? null,
          card_last4: latest.card_last4 ?? null,
          card_exp_month: latest.card_exp_month ?? null,
          card_exp_year: latest.card_exp_year ?? null,
          updated_at: latest.updated_at ?? null,
        }
      : null;

    return NextResponse.json({ billing });
  } catch (error) {
    console.error('GET /api/billing/status failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load billing status') }, { status: 500 });
  }
}
