import type { SupabaseClient } from '@supabase/supabase-js';

export async function logAudit(
  supabase: SupabaseClient,
  params: {
    action: string;
    actor: string;
    status: 'success' | 'warning' | 'error' | 'info';
    details?: string;
    pipeline_id?: string;
    records_affected?: number;
  }
) {
  // Note: audit_logs has no `direction` column — the API route derives it
  // by joining pipeline_id back to the pipeline's direction when reading.
  const { error } = await supabase.from('audit_logs').insert({
    action: params.action,
    actor: params.actor,
    status: params.status,
    details: params.details,
    pipeline_id: params.pipeline_id,
    records_affected: params.records_affected,
  });
  if (error) {
    console.error('Failed to write audit log:', error);
  }
}
