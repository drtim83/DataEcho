import { NextResponse } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '@/lib/mcp-server';
import { requireUser } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Next.js App Router doesn't support the persistent SSE connections a standard
// SSEServerTransport needs, so instead of a separate always-on MCP process we
// connect a real McpServer to a real MCP Client over an in-memory transport
// pair per request, then dispatch through the actual protocol (client.callTool).
// This keeps this route as a thin bridge rather than a second copy of the tool logic.

async function withMcpClient<T>(supabase: SupabaseClient, fn: (client: Client) => Promise<T>): Promise<T> {
  const server = createMcpServer(supabase);
  const client = new Client({ name: 'dataecho-web-bridge', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { tool, params } = body;

    if (!tool) {
      return NextResponse.json({ error: 'Missing tool name' }, { status: 400 });
    }

    const result = await withMcpClient(supabase, (client) =>
      client.callTool({ name: tool, arguments: params || {} })
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof McpError && error.code === ErrorCode.MethodNotFound) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tools = await withMcpClient(supabase, (client) => client.listTools());
  return NextResponse.json({
    name: 'dataecho-mcp-server',
    version: '1.0.0',
    status: 'online',
    message: 'MCP Bridge Server is running. Send POST requests to invoke tools.',
    tools: tools.tools.map((t) => ({ name: t.name, description: t.description })),
  });
}
