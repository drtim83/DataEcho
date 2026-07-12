'use client';

import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function PaymentForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');

    const { error: stripeError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message || 'Failed to save card');
      setSubmitting(false);
      return;
    }

    if (setupIntent?.status === 'succeeded') {
      const res = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupIntentId: setupIntent.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save card');
        setSubmitting(false);
        return;
      }
      onSuccess();
    } else {
      setError(`Payment setup incomplete (status: ${setupIntent?.status})`);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="text-xs py-2 px-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>{error}</div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary flex-1 disabled:opacity-50" disabled={!stripe || submitting}>
          {submitting ? 'Saving…' : 'Save Card'}
        </button>
      </div>
    </form>
  );
}

export default function AddPaymentMethodModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/billing/setup-intent', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        else setError(data.error || 'Failed to start payment setup');
      });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-strong rounded-2xl p-6 w-full max-w-md animate-fade-in-scale">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Add Payment Method</h3>
          <button onClick={onClose} className="text-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>
        {error && (
          <div className="text-xs py-2 px-4 rounded-lg mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>{error}</div>
        )}
        {clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <PaymentForm onSuccess={onSuccess} onClose={onClose} />
          </Elements>
        ) : !error ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : null}
      </div>
    </div>
  );
}
