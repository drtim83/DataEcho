import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    // Stripe's default Node https-based client fails outbound requests in
    // Netlify's function runtime ("connection to Stripe" errors on every
    // call); the fetch-based client works there.
    stripeClient = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  }
  return stripeClient;
}
