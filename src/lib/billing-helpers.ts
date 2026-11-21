import type { Firestore } from 'firebase-admin/firestore';
import { getStripe } from './stripe';

const BYTES_PER_GB = 1024 ** 3;

interface BillingDoc {
  stripe_customer_id?: string;
  connector_item_id?: string | null;
  usage_item_id?: string | null;
  updated_at?: string;
}

async function getLatestBillingAccount(
  db: Firestore
): Promise<BillingDoc | null> {
  const snap = await db.collection('billing_accounts').get();
  if (snap.empty) return null;
  const docs = snap.docs
    .map((d) => d.data() as BillingDoc)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  return docs[0] ?? null;
}

// Keeps the licensed per-connector subscription item's quantity in sync with
// the real connector count. No-op if no subscription exists yet (no payment
// method on file) — best-effort, never blocks the connector operation itself.
export async function syncConnectorQuantity(db: Firestore): Promise<void> {
  try {
    const snap = await db.collection('billing_accounts').get();
    const billing = snap.docs
      .map((d) => d.data() as BillingDoc)
      .filter((d) => Boolean(d.connector_item_id))
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0];

    if (!billing?.connector_item_id) return;

    const countSnap = await db.collection('connectors').count().get();
    const count = countSnap.data().count;

    const stripe = getStripe();
    await stripe.subscriptionItems.update(billing.connector_item_id, {
      quantity: count ?? 0,
    });
  } catch (err) {
    console.error('Failed to sync connector quantity to Stripe:', err);
  }
}

// Reports real transferred bytes (converted to GB) as a Stripe meter event so
// the GB-overage subscription item accrues usage. No-op if no subscription
// exists yet — best-effort, never blocks the pipeline run itself.
export async function reportUsage(
  db: Firestore,
  bytesTransferred: number
): Promise<void> {
  try {
    if (!bytesTransferred || bytesTransferred <= 0) return;

    const snap = await db.collection('billing_accounts').get();
    const billing = snap.docs
      .map((d) => d.data() as BillingDoc)
      .filter((d) => Boolean(d.usage_item_id))
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0];

    if (!billing?.stripe_customer_id) return;

    const eventName = process.env.STRIPE_METER_EVENT_NAME;
    if (!eventName) return;

    // Stripe rejects meter event values with more than 12 decimal places,
    // which a raw bytes/GB division routinely produces for small transfers.
    const gb = (bytesTransferred / BYTES_PER_GB).toFixed(12);
    if (Number(gb) <= 0) return;

    const stripe = getStripe();
    await stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: {
        stripe_customer_id: billing.stripe_customer_id,
        value: gb,
      },
    });
  } catch (err) {
    console.error('Failed to report usage to Stripe:', err);
  }
}

export { getLatestBillingAccount };
