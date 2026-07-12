import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { getConnectorConnectionInput } from '@/lib/connector-helpers';
import { getColumns } from '@/lib/db-schema';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const connectorId = url.searchParams.get('connector_id');
    const table = url.searchParams.get('table');
    if (!connectorId || !table) return NextResponse.json({ error: 'connector_id and table are required' }, { status: 400 });

    const conn = await getConnectorConnectionInput(supabase, connectorId);
    const columns = await getColumns(conn, table);

    return NextResponse.json({ columns });
  } catch (error) {
    console.error('GET /api/schema/columns failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to list columns') }, { status: 500 });
  }
}
