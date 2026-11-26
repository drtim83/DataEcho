import type { Firestore } from 'firebase-admin/firestore';

export async function logAudit(
  db: Firestore,
  params: {
    action: string;
    actor: string;
    status: 'success' | 'warning' | 'error' | 'info';
    details?: string;
    pipeline_id?: string;
    records_affected?: number;
  }
) {
  try {
    // Note: audit_logs has no `direction` field — the API route derives it
    // by joining pipeline_id back to the pipeline's direction when reading.
    await db.collection('audit_logs').add({
      action: params.action,
      actor: params.actor,
      status: params.status,
      details: params.details ?? null,
      pipeline_id: params.pipeline_id ?? null,
      records_affected: params.records_affected ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
