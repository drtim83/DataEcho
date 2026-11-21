import { NextResponse } from 'next/server';
import { requireAdmin, errorMessage } from '@/lib/firebase/server';
import { testConnection } from '@/lib/db-test';
import { decrypt } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';
import type { ConnectorType } from '@/types';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, admin } = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!admin) return NextResponse.json({ error: 'Only admins can manage connectors' }, { status: 403 });

    const { id } = await params;

    const ref = db.collection('connectors').doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    const row = snap.data() as {
      name: string;
      type: ConnectorType;
      config?: { host?: string; port?: number; database?: string; username?: string; password?: string };
    };

    const config = row.config || {};
    const result = await testConnection({
      type: row.type,
      host: config.host || '',
      port: config.port,
      database: config.database || '',
      username: config.username,
      password: config.password ? decrypt(config.password) : undefined,
    });

    const newStatus = !result.supported ? 'configuring' : result.success ? 'connected' : 'error';
    await ref.update({ status: newStatus, last_accessed: new Date().toISOString() });

    await logAudit(db, {
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
