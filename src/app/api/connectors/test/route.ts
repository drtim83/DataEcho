import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';
import { testConnection } from '@/lib/db-test';
import type { ConnectorType } from '@/types';

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { type, host, port, database, username, password } = body;

    if (!type || !host || !database) {
      return NextResponse.json({ error: 'type, host, and database are required' }, { status: 400 });
    }

    const result = await testConnection({
      type: type as ConnectorType,
      host,
      port: port ? Number(port) : undefined,
      database,
      username,
      password,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, 'Test failed') }, { status: 500 });
  }
}
