import type { PipelineDirection } from '@/types';

// Illustrative rate card (not tied to any real infrastructure cost), applied to
// genuine usage figures (real record counts, real elapsed sync time) rather
// than being a fabricated total.
export const RATE_CARD: Record<PipelineDirection, { label: string; perTenKRows: number; perComputeMinute: number }> = {
  cloud_bound: { label: 'Cloud Ingress', perTenKRows: 0.10, perComputeMinute: 0.02 },
  on_prem_bound: { label: 'On-Prem Egress', perTenKRows: 0.25, perComputeMinute: 0.05 },
  bidirectional: { label: 'Bidirectional', perTenKRows: 0.30, perComputeMinute: 0.06 },
};

export function computeCost(direction: PipelineDirection, records: number, computeMs: number): number {
  const rate = RATE_CARD[direction] ?? RATE_CARD.cloud_bound;
  return (records / 10000) * rate.perTenKRows + (computeMs / 60000) * rate.perComputeMinute;
}
