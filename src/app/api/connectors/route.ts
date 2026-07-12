import { NextResponse } from 'next/server';
import { requireUser, requireAdmin, errorMessage } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';
import { syncConnectorQuantity } from '@/lib/billing-helpers';
import type { Connector, ConnectorCategory, ConnectorRole, ConnectorType } from '@/types';

interface ConnectorRow {
  id: string;
  name: string;
  type: ConnectorType;
  category: ConnectorCategory;
  role: ConnectorRole;
  config: { host?: string; port?: number; database?: string; username?: string };
  status: string;
  tables_count: number | null;
  last_accessed: string | null;
  created_at: string;
}

function toConnector(row: ConnectorRow): Connector {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    category: row.category,
    role: row.role,
    host: row.config?.host,
    port: row.config?.port,
    database: row.config?.database,
    status: row.status as Connector['status'],
    tables_count: row.tables_count ?? 0,
    last_accessed: row.last_accessed || row.created_at,
    created_at: row.created_at,
  };
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('connectors')
      .select('id, name, type, category, role, config, status, tables_count, last_accessed, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ connectors: (data as ConnectorRow[]).map(toConnector) });
  } catch (error) {
    console.error('GET /api/connectors failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load connectors') }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, admin } = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!admin) return NextResponse.json({ error: 'Only admins can manage connectors' }, { status: 403 });

    const body = await req.json();
    const { name, type, category, role, host, port, database, username, password, status } = body;

    if (!name || !type || !category) {
      return NextResponse.json({ error: 'name, type, and category are required' }, { status: 400 });
    }
    if (role && !['source', 'target', 'both'].includes(role)) {
      return NextResponse.json({ error: 'role must be "source", "target", or "both"' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('connectors')
      .insert({
        name,
        type,
        category,
        role: role || 'both',
        status: status || 'configuring',
        config: {
          host,
          port: port ? Number(port) : undefined,
          database,
          username,
          password: password ? encrypt(password) : undefined,
        },
        last_accessed: new Date().toISOString(),
      })
      .select('id, name, type, category, role, config, status, tables_count, last_accessed, created_at')
      .single();

    if (error) throw error;

    await logAudit(supabase, {
      action: 'connector.create',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Created connector "${name}" (${type})`,
    });

    await syncConnectorQuantity(supabase);

    return NextResponse.json({ connector: toConnector(data as ConnectorRow) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/connectors failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to create connector') }, { status: 500 });
  }
}
