import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { getConnectorConnectionInput } from '@/lib/connector-helpers';
import { listTables } from '@/lib/db-schema';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const connectorId = new URL(req.url).searchParams.get('connector_id');
    if (!connectorId) return NextResponse.json({ error: 'connector_id is required' }, { status: 400 });

    const conn = await getConnectorConnectionInput(supabase, connectorId);
    const tables = await listTables(conn);

    return NextResponse.json({ tables });
  } catch (error) {
    console.error('GET /api/schema/tables failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to list tables') }, { status: 500 });
  }
}
