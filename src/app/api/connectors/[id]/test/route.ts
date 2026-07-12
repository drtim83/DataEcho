import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { testConnection } from '@/lib/db-test';
import { decrypt } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';
import type { ConnectorType } from '@/types';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { data: row, error: fetchError } = await supabase
      .from('connectors')
      .select('id, name, type, config')
      .eq('id', id)
      .single();

    if (fetchError || !row) {
      console.error(`POST /api/connectors/${id}/test failed to fetch connector:`, fetchError);
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    const config = row.config as { host?: string; port?: number; database?: string; username?: string; password?: string };
    const result = await testConnection({
      type: row.type as ConnectorType,
      host: config?.host || '',
      port: config?.port,
      database: config?.database || '',
      username: config?.username,
      password: config?.password ? decrypt(config.password) : undefined,
    });

    const newStatus = !result.supported ? 'configuring' : result.success ? 'connected' : 'error';
    const { error: updateError } = await supabase
      .from('connectors')
      .update({ status: newStatus, last_accessed: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    await logAudit(supabase, {
      action: 'connector.test',
      actor: user.email ?? user.id,
      status: result.success ? 'success' : 'error',
      details: `Tested connector "${row.name}": ${result.message}`,
    });

    return NextResponse.json({ ...result, status: newStatus });
  } catch (error) {
    console.error('POST /api/connectors/[id]/test failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Test failed') }, { status: 500 });
  }
}
