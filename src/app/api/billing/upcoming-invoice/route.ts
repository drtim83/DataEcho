import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: billing } = await supabase
      .from('billing_accounts')
      .select('stripe_customer_id, stripe_subscription_id')
      .not('stripe_subscription_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!billing?.stripe_customer_id || !billing?.stripe_subscription_id) {
      return NextResponse.json({ invoice: null });
    }

    const stripe = getStripe();
    const invoice = await stripe.invoices.createPreview({
      customer: billing.stripe_customer_id,
      subscription: billing.stripe_subscription_id,
    });

    return NextResponse.json({
      invoice: {
        currency: invoice.currency,
        amount_due: invoice.amount_due,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
        lines: invoice.lines.data.map((line) => ({
          description: line.description,
          amount: line.amount,
          quantity: line.quantity,
        })),
      },
    });
  } catch (error) {
    console.error('GET /api/billing/upcoming-invoice failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load upcoming invoice') }, { status: 500 });
  }
}
