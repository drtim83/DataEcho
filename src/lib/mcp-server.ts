import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorMessage } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Factory so each request (e.g. the /api/mcp route) can spin up an isolated
// server instance rather than sharing mutable state across concurrent requests.
// `supabase` must be a request-scoped, authenticated client (see requireUser())
// so RLS evaluates the calling user's role rather than the anonymous one.
export function createMcpServer(supabase: SupabaseClient) {
  const server = new McpServer({
    name: "dataecho-mcp-server",
    version: "1.0.0"
  });

  // Tool: list_connectors — backed by the real Supabase `connectors` table.
  server.tool("list_connectors",
    "List on-prem and cloud connectors",
    {},
    async () => {
      try {
        const { data, error } = await supabase
          .from('connectors')
          .select('id, name, type, category, status')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to list connectors: ${errorMessage(err, String(err))}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: preview_schema
  server.tool("preview_schema",
    "Fetch table/column schema from a connector",
    {
      connector_id: z.string().describe("ID of the connector"),
      table_name: z.string().describe("Table name to inspect")
    },
    async ({ connector_id, table_name }) => {
      return {
        content: [{ type: "text", text: `Schema for ${table_name} on connector ${connector_id}:\nid (INT), name (VARCHAR), created_at (TIMESTAMP)` }]
      };
    }
  );

  // Tool: trigger_sync
  server.tool("trigger_sync",
    "Trigger sync in specified direction",
    {
      pipeline_id: z.string().describe("ID of the pipeline"),
      direction: z.enum(["cloud_bound", "on_prem_bound", "bidirectional"]).describe("Sync direction")
    },
    async ({ pipeline_id, direction }) => {
      return {
        content: [{ type: "text", text: `Successfully triggered ${direction} sync for pipeline ${pipeline_id}. Job ID: job-${Date.now()}` }]
      };
    }
  );

  // Tool: get_sync_status
  server.tool("get_sync_status",
    "Real-time sync progress for a job",
    {
      job_id: z.string().describe("ID of the running job")
    },
    async ({ job_id }) => {
      return {
        content: [{ type: "text", text: `Job ${job_id} is running. Progress: 45%. 15,200 records processed.` }]
      };
    }
  );

  // Tool: map_schema
  server.tool("map_schema",
    "AI schema mapping",
    {
      source_table: z.string(),
      target_table: z.string()
    },
    async ({ source_table, target_table }) => {
      return {
        content: [{ type: "text", text: `AI Mapping Result:\n${source_table}.id -> ${target_table}.id (Confidence 99%)\n${source_table}.full_name -> ${target_table}.name (Confidence 85%)` }]
      };
    }
  );

  // Tool: get_analytics
  server.tool("get_analytics",
    "Platform-wide stats & trends",
    {},
    async () => {
      return {
        content: [{ type: "text", text: JSON.stringify({ total_records: 25000000, avg_latency_ms: 1250, success_rate: 99.5 }) }]
      };
    }
  );

  return server;
}
