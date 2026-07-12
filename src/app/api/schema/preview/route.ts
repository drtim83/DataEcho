import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { getConnectorConnectionInput } from '@/lib/connector-helpers';
import { previewTable } from '@/lib/db-sync';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const connectorId = url.searchParams.get('connector_id');
    const table = url.searchParams.get('table');
    if (!connectorId || !table) return NextResponse.json({ error: 'connector_id and table are required' }, { status: 400 });

    const conn = await getConnectorConnectionInput(supabase, connectorId);
    const rows = await previewTable(conn, table);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return NextResponse.json({ columns, rows });
  } catch (error) {
    console.error('GET /api/schema/preview failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to preview table') }, { status: 500 });
  }
}
