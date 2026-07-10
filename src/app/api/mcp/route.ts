import { NextResponse } from 'next/server';
import { server } from '@/lib/mcp-server';

// Since Next.js App Router doesn't easily support persistent SSE connections 
// required by the standard SSEServerTransport without complex streams,
// we provide a standard HTTP POST endpoint to interact with the MCP tools.
// In a full production setup, you would run the MCP server as a separate Node process 
// using stdio or a dedicated WebSocket/SSE server.

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Simple command dispatcher for the demo
    const { tool, params } = body;

    if (!tool) {
      return NextResponse.json({ error: 'Missing tool name' }, { status: 400 });
    }

    // Direct invocation of the tools (simulated MCP routing for the Next.js API)
    // Normally this is handled by server.connect(transport)
    let result;
    
    switch (tool) {
      case 'list_connectors':
        result = { content: [{ type: "text", text: JSON.stringify([{ id: 'c1', name: 'SQL Server Prod', type: 'mssql', category: 'on_prem' }, { id: 'c2', name: 'Snowflake WH', type: 'snowflake', category: 'cloud' }]) }] };
        break;
      case 'trigger_sync':
        result = { content: [{ type: "text", text: `Successfully triggered ${params?.direction} sync for pipeline ${params?.pipeline_id}. Job ID: job-${Date.now()}` }] };
        break;
      case 'get_analytics':
        result = { content: [{ type: "text", text: JSON.stringify({ total_records: 25000000, avg_latency_ms: 1250, success_rate: 99.5 }) }] };
        break;
      default:
        return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    name: 'dataecho-mcp-server',
    version: '1.0.0',
    status: 'online',
    message: 'MCP Bridge Server is running. Send POST requests to invoke tools.'
  });
}
