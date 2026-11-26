import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/firebase/server';
import { getStripe } from '@/lib/stripe';

export async function GET() {
  try {
    const { db, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const snap = await db.collection('billing_accounts').get();
    const billing = snap.docs
      .map((d) => d.data())
      .filter((d) => Boolean(d.stripe_subscription_id))
      .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))[0];

    if (!billing?.stripe_customer_id || !billing?.stripe_subscription_id) {
      return NextResponse.json({ invoice: null });
    }

    const stripe = getStripe();
    const invoice = await stripe.invoices.createPreview({
      customer: billing.stripe_customer_id as string,
      subscription: billing.stripe_subscription_id as string,
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
