'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { formatNumber, formatBytes, getDirectionLabel, getDirectionColor } from '@/lib/utils';
import { RATE_CARD } from '@/lib/pricing';
import AddPaymentMethodModal from '@/components/billing/AddPaymentMethodModal';

interface MeteringSummary {
  total_cost: number; total_records: number; total_bytes: number;
  cloud_bound_cost: number; on_prem_bound_cost: number; bidirectional_cost: number;
}
interface DailyCost { date: string; cloud: number; onPrem: number; bi: number; }
interface PipelineCost { pipeline_id: string; pipeline_name: string; direction?: string; records: number; bytes: number; compute_ms: number; cost: number; }
type BillingInfo = { card_brand: string; card_last4: string; card_exp_month: number; card_exp_year: number } | null;
type UpcomingInvoice = {
  currency: string;
  amount_due: number;
  period_start: number;
  period_end: number;
  lines: { description: string | null; amount: number; quantity: number | null }[];
} | null;

export default function MeteringPage() {
  const [summary, setSummary] = useState<MeteringSummary | null>(null);
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([]);
  const [pipelineCosts, setPipelineCosts] = useState<PipelineCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [billing, setBilling] = useState<BillingInfo>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [upcomingInvoice, setUpcomingInvoice] = useState<UpcomingInvoice>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(true);

  function loadBilling() {
    fetch('/api/billing/status').then((r) => r.json()).then((data) => setBilling(data.billing || null));
    setInvoiceLoading(true);
    fetch('/api/billing/upcoming-invoice').then((r) => r.json()).then((data) => setUpcomingInvoice(data.invoice || null)).finally(() => setInvoiceLoading(false));
  }

  useEffect(() => {
    fetch('/api/metering').then((r) => r.json()).then((data) => {
      setSummary(data.summary);
      setDailyCosts(data.daily_costs || []);
      setPipelineCosts(data.pipeline_costs || []);
    }).finally(() => setLoading(false));
    fetch('/api/profile').then((r) => r.json()).then((data) => setIsAdmin(data.profile?.role === 'admin'));
    loadBilling();
  }, []);

  if (loading || !summary) {
    return (
      <>
        <TopBar title="Metering Dashboard" subtitle="Usage-based billing and cost tracking" />
        <div className="p-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>{loading ? 'Loading…' : 'No data available.'}</div>
      </>
    );
  }

  const maxDailyCost = Math.max(1, ...dailyCosts.map((d) => d.cloud + d.onPrem + d.bi));
  const pct = (v: number) => summary.total_cost > 0 ? Math.round((v / summary.total_cost) * 100) : 0;

  return (
    <>
      <TopBar title="Metering Dashboard" subtitle="Cost computed from real sync volume against the rate card below" />
      <div className="p-8 space-y-6">
        {/* Billing Summary Cards */}
        <div className="grid grid-cols-4 gap-4 stagger-children">
          <div className="glass-card p-5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total Cost (All Time)</p>
            <p className="text-3xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>${summary.total_cost.toFixed(2)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{formatNumber(summary.total_records)} records · {formatBytes(summary.total_bytes)}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Cloud Ingress</p>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-accent-teal)' }}>${summary.cloud_bound_cost.toFixed(2)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{pct(summary.cloud_bound_cost)}% of total</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>On-Prem Egress</p>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-accent-amber)' }}>${summary.on_prem_bound_cost.toFixed(2)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{pct(summary.on_prem_bound_cost)}% of total</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Bidirectional</p>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-accent-purple)' }}>${summary.bidirectional_cost.toFixed(2)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{pct(summary.bidirectional_cost)}% of total</p>
          </div>
        </div>

        {/* Billing / Payment Method */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>💳 Payment Method</h3>
              {billing ? (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {billing.card_brand?.toUpperCase()} •••• {billing.card_last4} — expires {billing.card_exp_month}/{billing.card_exp_year}
                </p>
              ) : (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>No payment method on file.</p>
              )}
            </div>
            {isAdmin ? (
              <button className="btn-secondary text-xs" onClick={() => setShowPaymentModal(true)}>
                {billing ? 'Update Payment Method' : '+ Add Payment Method'}
              </button>
            ) : (
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Only admins can manage billing.</span>
            )}
          </div>
        </div>

        {showPaymentModal && (
          <AddPaymentMethodModal
            onClose={() => setShowPaymentModal(false)}
            onSuccess={() => { setShowPaymentModal(false); loadBilling(); }}
          />
        )}

        {/* Upcoming Invoice */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>🧾 Upcoming Invoice</h3>
          {invoiceLoading ? (
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
          ) : !upcomingInvoice ? (
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {billing ? 'No active subscription yet.' : 'Add a payment method to start a subscription.'}
            </p>
          ) : (
            <>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Live projection from Stripe for the period {new Date(upcomingInvoice.period_start * 1000).toLocaleDateString()} – {new Date(upcomingInvoice.period_end * 1000).toLocaleDateString()}
              </p>
              <p className="text-3xl font-bold mt-3" style={{ color: 'var(--color-text-primary)' }}>
                ${(upcomingInvoice.amount_due / 100).toFixed(2)} <span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>{upcomingInvoice.currency.toUpperCase()}</span>
              </p>
              <div className="mt-4 space-y-2">
                {upcomingInvoice.lines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <span>{line.description ?? 'Line item'}{line.quantity != null ? ` × ${line.quantity}` : ''}</span>
                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>${(line.amount / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Cost Over Time Chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Cost by Direction (Daily)</h3>
          {dailyCosts.length === 0 ? (
            <p className="text-xs text-center py-10" style={{ color: 'var(--color-text-muted)' }}>No metered runs yet.</p>
          ) : (
            <>
              <div className="flex items-end gap-1 h-[200px]">
                {dailyCosts.map((day, i) => {
                  const total = day.cloud + day.onPrem + day.bi;
                  const biH = (day.bi / maxDailyCost) * 100;
                  const onPremH = (day.onPrem / maxDailyCost) * 100;
                  const cloudH = (day.cloud / maxDailyCost) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${day.date}: $${total.toFixed(2)}`}>
                      <div className="w-full flex flex-col">
                        <div className="w-full rounded-t-sm" style={{ height: `${biH}%`, background: 'var(--color-accent-purple)', minHeight: biH > 0 ? '2px' : '0' }}></div>
                        <div className="w-full" style={{ height: `${onPremH}%`, background: 'var(--color-accent-amber)', minHeight: onPremH > 0 ? '2px' : '0' }}></div>
                        <div className="w-full" style={{ height: `${cloudH}%`, background: 'var(--color-accent-teal)', minHeight: cloudH > 0 ? '2px' : '0' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                {[
                  { label: 'Cloud Ingress', color: 'var(--color-accent-teal)' },
                  { label: 'On-Prem Egress', color: 'var(--color-accent-amber)' },
                  { label: 'Bidirectional', color: 'var(--color-accent-purple)' },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: l.color }}></div>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Cost by Pipeline Table */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Cost by Pipeline</h3>
          {pipelineCosts.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>No metered runs yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  {['Pipeline', 'Direction', 'Records', 'Data Transfer', 'Compute', 'Cost'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipelineCosts.map((pc) => (
                  <tr key={pc.pipeline_id} className="table-row" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{pc.pipeline_name}</td>
                    <td className="px-4 py-3">
                      {pc.direction && <span className={`badge badge-${getDirectionColor(pc.direction)} text-[10px]`}>{getDirectionLabel(pc.direction)}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatNumber(pc.records)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatBytes(pc.bytes)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{(pc.compute_ms / 1000).toFixed(1)}s</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>${pc.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Rate Card */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>📋 Rate Card</h3>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(RATE_CARD).map(([key, t]) => (
              <div key={key} className="p-4 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t.label}</p>
                <p className="text-lg font-bold mt-2" style={{ color: 'var(--color-accent-blue)' }}>${t.perTenKRows.toFixed(2)} / 10K rows</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Compute: ${t.perComputeMinute.toFixed(2)} / min</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
