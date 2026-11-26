import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Firestore } from "firebase-admin/firestore";
import { errorMessage, type AppUser } from "@/lib/firebase/server";
import { getConnectorConnectionInput } from "@/lib/connector-helpers";
import { getColumns } from "@/lib/db-schema";
import { runPipelineSync, runSchemaMapping, PipelineActionError } from "@/lib/pipeline-actions";
import { computeAnalytics } from "@/lib/analytics";

// Factory so each request (e.g. the /api/mcp route) can spin up an isolated
// server instance rather than sharing mutable state across concurrent requests.
// `db` is the authenticated server-side Firestore instance and `user` backs the
// actor field on audit log entries written by tools that mutate data
// (trigger_sync, map_schema) — same as the equivalent API routes.
export function createMcpServer(db: Firestore, user: AppUser) {
  const server = new McpServer({
    name: "dataecho-mcp-server",
    version: "1.0.0"
  });

  // Tool: list_connectors — backed by the Firestore `connectors` collection.
  server.tool("list_connectors",
    "List on-prem and cloud connectors",
    {},
    async () => {
      try {
        const snap = await db
          .collection('connectors')
          .orderBy('created_at', 'desc')
          .get();
        const data = snap.docs.map((d) => {
          const row = d.data();
          return {
            id: d.id,
            name: row.name,
            type: row.type,
            category: row.category,
            status: row.status,
          };
        });
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to list connectors: ${errorMessage(err, String(err))}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: preview_schema — real INFORMATION_SCHEMA introspection against the
  // connector's live database (same code path as GET /api/schema/columns).
  server.tool("preview_schema",
    "Fetch real table/column schema from a connector",
    {
      connector_id: z.string().describe("ID of the connector"),
      table_name: z.string().describe("Table name to inspect (schema.table for a non-default schema)")
    },
    async ({ connector_id, table_name }) => {
      try {
        const conn = await getConnectorConnectionInput(db, connector_id);
        const columns = await getColumns(conn, table_name);
        return { content: [{ type: "text", text: JSON.stringify(columns) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to fetch schema: ${errorMessage(err, String(err))}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: trigger_sync — runs the real synchronous sync engine (extracts from
  // the source connector, loads into the target, records a sync_runs doc and
  // metering event) using the pipeline's already-configured direction and
  // schema mapping. Same code path as POST /api/pipelines/[id]/run.
  server.tool("trigger_sync",
    "Run a real data sync for a pipeline using its configured direction and schema mapping",
    {
      pipeline_id: z.string().describe("ID of the pipeline to sync")
    },
    async ({ pipeline_id }) => {
      try {
        const { run, syncResult, runError, pipelineName } = await runPipelineSync(db, user, pipeline_id);
        if (runError) {
          return {
            content: [{ type: "text", text: `Sync failed for pipeline "${pipelineName}": ${runError}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: `Synced ${syncResult?.recordsLoaded ?? 0} rows for pipeline "${pipelineName}". Run ID: ${run.id}` }]
        };
      } catch (err) {
        const message = err instanceof PipelineActionError ? err.message : errorMessage(err, String(err));
        return { content: [{ type: "text", text: `Failed to trigger sync: ${message}` }], isError: true };
      }
    }
  );

  // Tool: get_sync_status — real status of a completed or failed run from the
  // sync_runs collection. Runs execute synchronously, so by the time trigger_sync
  // returns, the run it created is already in a terminal state.
  server.tool("get_sync_status",
    "Real status and record count for a sync run",
    {
      run_id: z.string().describe("ID of the sync run, e.g. as returned by trigger_sync")
    },
    async ({ run_id }) => {
      try {
        const snap = await db.collection('sync_runs').doc(run_id).get();
        if (!snap.exists) {
          return { content: [{ type: "text", text: `Sync run ${run_id} not found` }], isError: true };
        }
        const row = snap.data()!;
        const data = {
          id: snap.id,
          pipeline_id: row.pipeline_id,
          direction: row.direction,
          status: row.status,
          records: row.records,
          started_at: row.started_at,
          completed_at: row.completed_at,
          error: row.error ?? null,
        };
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Failed to fetch sync status: ${errorMessage(err, String(err))}` }], isError: true };
      }
    }
  );

  // Tool: map_schema — runs the real heuristic (Levenshtein + type-category)
  // mapping engine against the pipeline's live source/target schemas and
  // persists the result. Same code path as POST /api/schema/map.
  server.tool("map_schema",
    "Generate and save a real column mapping between a pipeline's source and target tables",
    {
      pipeline_id: z.string().describe("ID of the pipeline to map")
    },
    async ({ pipeline_id }) => {
      try {
        const { mappings, pipelineName } = await runSchemaMapping(db, user, pipeline_id);
        return { content: [{ type: "text", text: `Mapped ${mappings.length} columns for pipeline "${pipelineName}":\n${JSON.stringify(mappings)}` }] };
      } catch (err) {
        const message = err instanceof PipelineActionError ? err.message : errorMessage(err, String(err));
        return { content: [{ type: "text", text: `Failed to map schema: ${message}` }], isError: true };
      }
    }
  );

  // Tool: get_analytics — real aggregation over sync_runs/pipelines/connectors
  // (same code path as GET /api/analytics), not canned totals.
  server.tool("get_analytics",
    "Real platform-wide stats & trends computed from sync history",
    {},
    async () => {
      try {
        const analytics = await computeAnalytics(db);
        return { content: [{ type: "text", text: JSON.stringify(analytics.overview) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Failed to compute analytics: ${errorMessage(err, String(err))}` }], isError: true };
      }
    }
  );

  return server;
}
