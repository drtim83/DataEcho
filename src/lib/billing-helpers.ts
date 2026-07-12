import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from './stripe';

const BYTES_PER_GB = 1024 ** 3;

// Keeps the licensed per-connector subscription item's quantity in sync with
// the real connector count. No-op if no subscription exists yet (no payment
// method on file) — best-effort, never blocks the connector operation itself.
export async function syncConnectorQuantity(supabase: SupabaseClient): Promise<void> {
  try {
    const { data: billing } = await supabase
      .from('billing_accounts')
      .select('connector_item_id')
      .not('connector_item_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!billing?.connector_item_id) return;

    const { count } = await supabase.from('connectors').select('id', { count: 'exact', head: true });

    const stripe = getStripe();
    await stripe.subscriptionItems.update(billing.connector_item_id, { quantity: count ?? 0 });
  } catch (err) {
    console.error('Failed to sync connector quantity to Stripe:', err);
  }
}

// Reports real transferred bytes (converted to GB) as a Stripe meter event so
// the GB-overage subscription item accrues usage. No-op if no subscription
// exists yet — best-effort, never blocks the pipeline run itself.
export async function reportUsage(supabase: SupabaseClient, bytesTransferred: number): Promise<void> {
  try {
    if (!bytesTransferred || bytesTransferred <= 0) return;

    const { data: billing } = await supabase
      .from('billing_accounts')
      .select('stripe_customer_id, usage_item_id')
      .not('usage_item_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!billing?.stripe_customer_id) return;

    const eventName = process.env.STRIPE_METER_EVENT_NAME;
    if (!eventName) return;

    const gb = bytesTransferred / BYTES_PER_GB;

    const stripe = getStripe();
    await stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: {
        stripe_customer_id: billing.stripe_customer_id,
        value: gb.toString(),
      },
    });
  } catch (err) {
    console.error('Failed to report usage to Stripe:', err);
  }
}
