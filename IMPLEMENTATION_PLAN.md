# DataEcho — Implementation Plan

This document tracks what has actually been built (verified live, not just
coded) and scopes what's next. See the in-app **User Guide** (`/guide`) for
end-user documentation; this file is for engineering planning.

Stack: Next.js 16 (App Router, Turbopack) · Supabase (Postgres, Auth, RLS) ·
real drivers (`mssql`, `pg`, `mysql2`) · Stripe (test mode) · deployed on
Netlify.

---

## Part 1 — What's Built

Everything below was verified live against real infrastructure (a real
Supabase project, real local Postgres test databases, real Stripe test-mode
API calls) — not just typechecked or assumed working.

### Auth & Security
- Real Supabase email/password auth, session cookies refreshed via `src/proxy.ts` + `src/lib/supabase/middleware.ts`.
- Row Level Security enabled on every table (`supabase/migrations/003`, `004`); the anon key alone cannot read or write anything without a valid session.
- Connector passwords encrypted at rest with AES-256-GCM (`src/lib/crypto.ts`), decrypted only server-side at connection time.
- Two roles (`profiles.role`: `admin` | `user`), enforced at both the API layer (`requireAdmin()` in `src/lib/supabase/server.ts`) and the database layer (`is_admin()` RLS policies, `supabase/migrations/006`) — redundant on purpose, so a bug in one layer doesn't remove the other.

### Connectors
- Real live-testing, schema introspection (`INFORMATION_SCHEMA`), and data preview for MS SQL Server, PostgreSQL, MySQL, and Supabase (`src/lib/db-test.ts`, `db-schema.ts`, `db-sync.ts`).
- SQL injection prevented via identifier allowlisting (`sanitizeIdentifier`), not string interpolation of user input.
- Other connector types (Oracle, DB2, Snowflake, Databricks, Iceberg, Salesforce, HubSpot, Stripe) can be recorded but honestly report "not implemented yet" for live features rather than faking a result.

### Pipelines, Canvas & Schema Mapping
- Visual pipeline canvas (`@xyflow/react`) with saved node/edge layout per pipeline.
- Schema mapping is a real deterministic heuristic (`src/lib/schema-mapper.ts`): normalized Levenshtein name similarity (75%) + type-category compatibility (25%), 0.35 confidence floor, greedy best-match assignment — explicitly not an LLM call.

### Sync Engine
- Synchronous, on-demand execution (`src/lib/db-sync.ts`, orchestrated by `src/lib/pipeline-actions.ts::runPipelineSync`), capped at 1,000 rows per run.
- Every run writes a real `sync_runs` row and, on success, a real `metering_events` row measuring actual serialized byte size transferred.
- No cron/queue — "Run" always means "run now, in this request."

### Analytics, Metering & Audit
- `/api/analytics` (`src/lib/analytics.ts`) aggregates real `sync_runs`/`pipelines`/`connectors` — overview, daily stats, connector usage, direction split, pipeline leaderboard, hourly throughput.
- `/api/metering` aggregates real `metering_events` against an illustrative internal rate card (`src/lib/pricing.ts`).
- Every mutating action writes a real `audit_logs` row (`src/lib/audit.ts`), surfaced on the Audit Trail page and the notification bell.

### Billing (Stripe, test mode)
- Hybrid pricing: **$25/connector/month** (licensed item, quantity kept in sync with the real connector count on every add/delete via `syncConnectorQuantity`) + **10 GB free, then $0.50/GB** (metered item via Stripe's Billing Meters API).
- Card collection via Stripe's hosted Payment Element — DataEcho never sees or stores raw card numbers, only Stripe references (`supabase/migrations/007`, `008`).
- Real usage reporting per sync run (`reportUsage` in `src/lib/billing-helpers.ts`), truncated to 12 decimal places (Stripe's meter-event precision limit — see Known Issues Fixed below).
- Live "Upcoming Invoice" projection on the Metering page via Stripe's Create Preview Invoice API.
- **Verified end-to-end live**: card added → subscription created (`sub_1TsQTQ...`) → connector added → subscription item quantity synced to 1 → pipeline run against a real local Postgres → meter event created and confirmed via Stripe's event-summary API (`aggregated_value: 0.000022546388`, exact match) → upcoming invoice reflects it.

### MCP Server
- Real Model Context Protocol server (`src/lib/mcp-server.ts`) bridged through `/api/mcp` (`GET` lists tools, `POST` invokes one) using an in-memory MCP client/server transport pair per request.
- All 6 tools run real logic, sharing implementation with the equivalent UI/API code paths (`src/lib/pipeline-actions.ts`, `src/lib/analytics.ts`) rather than duplicating it: `list_connectors`, `preview_schema`, `map_schema`, `trigger_sync`, `get_sync_status`, `get_analytics`.

### Demo Mode
- `/demo` is fully hardcoded, simulated data — safe for sales walkthroughs. One deliberate exception: a "Test Live Connection" button that runs one real read-only query, clearly separated from the simulated data around it.

### Deployment
- Live on Netlify (`dataecho-demo-app-v1.netlify.app`), same Supabase project as local dev.

### Known Issues Fixed This Cycle
- MCP tools were mostly hardcoded canned responses — rewired to real logic (biggest defect found in the codebase sweep).
- Notification bell read a nonexistent `created_at` field instead of `audit_logs.timestamp` — silently blanked every notification's time.
- `/api/audit-logs` ignored its `limit` query param, so the notification dropdown could render up to 200 rows instead of 10.
- Stripe meter events rejected values with >12 decimal places, which small syncs routinely produce from a raw bytes→GB division — usage reporting failed silently for any transfer well under 1 GB (i.e. almost all test traffic). Fixed by truncating to `toFixed(12)`.
- Demo page banner overstated itself ("never reads from your real connectors") when its own live-test button contradicted that.

---

## Part 2 — Scoped: Next Features

Three feature requests came up in this session. Scoped here in build order
(smallest/most valuable first); none of this is built yet.

### 2.1 Sync Mode: Append vs. Truncate & Reload

**Problem:** re-running a pipeline against a target with unique/primary keys
fails with a duplicate-key error, since every run is a plain insert.

**Approach:**
- Add `sync_mode TEXT DEFAULT 'append' CHECK (sync_mode IN ('append', 'truncate_reload'))` to `pipelines` (new migration).
- Canvas "New Pipeline" form: add a mode selector.
- `runPipelineSync` (`src/lib/pipeline-actions.ts`): when `sync_mode = 'truncate_reload'`, issue a `TRUNCATE` (or `DELETE FROM`, driver-dependent) against the target table before `insertRows()`, inside the same try block so a truncate failure surfaces as a normal run error.
- UI: warn before creating/editing a pipeline in this mode that it will destroy existing target data on every run.

**Effort:** small. One migration, one engine branch per driver (mssql/pg/mysql already have per-driver insert functions in `db-sync.ts` to extend symmetrically), one form control.

**Open question:** should truncate happen even if extraction from source fails, or only right before insert? (Recommend: only right before insert, so a source-side failure never destroys the target's existing data.)

### 2.2 Filtered Push-Back to Multiple Targets (1 source → N targets, by LOB/geo/etc.)

**Problem:** push data from one source out to several destination systems,
each getting a different filtered subset (e.g. by region or line of
business).

**Approach:**
- This is a materially different shape than today's 1:1 pipeline. Model it as one pipeline with multiple **destination edges**, each carrying its own filter expression — extends `pipeline_edges` (already exists for canvas visualization) with a `filter_sql` or structured filter (column, operator, value) column.
- Sync engine: extract from source once, then for each destination edge, apply its filter in-memory (or push down as a `WHERE` clause if the filter references only source columns and the source driver supports it) before loading to that edge's target.
- UI: canvas needs a way to edit a filter on an edge (e.g. click an edge → filter builder panel), and the "Run" flow needs to report per-destination results, not a single result.

**Effort:** moderate. Reuses the extraction and column-mapping already built; the new work is the filter model, filter UI, and per-edge result reporting/metering (each destination's transferred bytes should probably be metered separately).

**Open question:** filters as structured (column/operator/value dropdowns, safe by construction) vs. free-form SQL `WHERE` (more powerful, reopens injection-surface questions the identifier-allowlisting work was built to close). Recommend structured, at least initially.

### 2.3 Multi-Source Joins/Unions Into One Target

**Problem:** combine 2+ source tables (potentially on different database
engines) into one target — join or union.

**Approach:** this is the largest lift of the three, because a real SQL
`JOIN`/`UNION` can't run across two different physical database servers.
The only correct approach is: extract each source independently (reusing
`extractRows()`), then combine the resulting row sets **in application
memory** before loading, e.g. with a small in-memory join/union
implementation keyed on a configured join column, or (for UNION) a simple
column-aligned concatenation.

- Data model: a pipeline needs multiple source connectors/tables instead of one — likely a new `pipeline_sources` table (pipeline_id, connector_id, table_name, role: 'left' | 'right' | 'union_member').
- **UNION first**: same-shape tables, no join-key config needed, straightforward to combine and de-dupe/map. Reasonable first milestone.
- **JOIN second**: needs a join-key mapping UI (which column on each side), a join type (inner/left), and type reconciliation when the join columns aren't the same underlying type across engines (e.g. `INT` vs `NUMERIC`).
- At in-memory scale this only works within the existing 1,000-row cap's spirit — a naive in-memory join of two large tables extracted independently doesn't scale the way a database's own join planner would. Worth deciding early whether this stays a "small pipelines" feature or needs a different execution model (streaming/paginated join) for larger data.

**Effort:** large — a genuine engine rewrite, not an extension of the current one. Recommend treating this as its own project phase after 2.1 and 2.2 land, not bundled with them.

---

## Part 3 — Suggested Sequencing

1. **2.1 Truncate & Reload** — ships fast, unblocks realistic re-run testing (including the local-DB verification flow documented in the User Guide).
2. **2.2 Filtered multi-target push-back** — meaningful new capability, reuses most of the existing engine.
3. **2.3 Multi-source joins/unions** — biggest investment; scope as its own mini-project (data model, UNION milestone, then JOIN milestone) once 2.1/2.2 are stable.
