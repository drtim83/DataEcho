import { NextResponse } from 'next/server';
import { requireAdmin, errorMessage } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { logAudit } from '@/lib/audit';
import type Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    const { supabase, user, admin } = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!admin) return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 });

    const { setupIntentId } = await req.json();
    if (!setupIntentId) return NextResponse.json({ error: 'setupIntentId is required' }, { status: 400 });

    const stripe = getStripe();

    // Authoritative check — never trust the client's claim that setup succeeded.
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    if (setupIntent.status !== 'succeeded') {
      return NextResponse.json({ error: `Payment setup is not complete (status: ${setupIntent.status})` }, { status: 400 });
    }
    if (!setupIntent.payment_method || !setupIntent.customer) {
      return NextResponse.json({ error: 'Setup intent is missing a payment method or customer' }, { status: 400 });
    }

    const paymentMethodId = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method.id;
    const customerId = typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer.id;

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId) as Stripe.PaymentMethod;
    const card = paymentMethod.card;

    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });

    const { data: existing } = await supabase
      .from('billing_accounts')
      .select('id, stripe_subscription_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    let subscriptionId = existing?.stripe_subscription_id ?? null;
    let connectorItemId: string | null = null;
    let usageItemId: string | null = null;

    if (!subscriptionId) {
      const { count } = await supabase.from('connectors').select('id', { count: 'exact', head: true });

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [
          { price: process.env.STRIPE_PRICE_CONNECTOR, quantity: count ?? 0 },
          { price: process.env.STRIPE_PRICE_GB_OVERAGE },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
      });

      subscriptionId = subscription.id;
      connectorItemId = subscription.items.data.find((i) => i.price.id === process.env.STRIPE_PRICE_CONNECTOR)?.id ?? null;
      usageItemId = subscription.items.data.find((i) => i.price.id === process.env.STRIPE_PRICE_GB_OVERAGE)?.id ?? null;
    }

    const row = {
      stripe_customer_id: customerId,
      default_payment_method_id: paymentMethodId,
      card_brand: card?.brand,
      card_last4: card?.last4,
      card_exp_month: card?.exp_month,
      card_exp_year: card?.exp_year,
      updated_at: new Date().toISOString(),
      ...(subscriptionId && !existing?.stripe_subscription_id ? { stripe_subscription_id: subscriptionId, connector_item_id: connectorItemId, usage_item_id: usageItemId } : {}),
    };

    const { error } = existing
      ? await supabase.from('billing_accounts').update(row).eq('id', existing.id)
      : await supabase.from('billing_accounts').insert(row);

    if (error) throw error;

    await logAudit(supabase, {
      action: 'billing.payment_method_added',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Added ${card?.brand} card ending in ${card?.last4}`,
    });

    return NextResponse.json({ success: true, card_brand: card?.brand, card_last4: card?.last4 });
  } catch (error) {
    console.error('POST /api/billing/confirm failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to confirm payment method') }, { status: 500 });
  }
}
