import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('billing_accounts')
      .select('card_brand, card_last4, card_exp_month, card_exp_year, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ billing: data });
  } catch (error) {
    console.error('GET /api/billing/status failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load billing status') }, { status: 500 });
  }
}
