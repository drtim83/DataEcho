import { NextResponse } from 'next/server';
import { requireAdmin, errorMessage } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

export async function POST() {
  try {
    const { supabase, user, admin } = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!admin) return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 });

    const stripe = getStripe();

    const { data: existing } = await supabase
      .from('billing_accounts')
      .select('stripe_customer_id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerId = existing?.stripe_customer_id
      || (await stripe.customers.create({ email: user.email ?? undefined, name: 'DataEcho' })).id;

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret, customerId });
  } catch (error) {
    console.error('POST /api/billing/setup-intent failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to start payment setup') }, { status: 500 });
  }
}
