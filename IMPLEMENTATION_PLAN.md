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
API calls) — not just typechecked or assumed working, unless noted otherwise.

### Auth & Security
- Real Supabase email/password auth, session cookies refreshed via `src/proxy.ts` + `src/lib/supabase/middleware.ts`.
- Row Level Security enabled on every table (`supabase/migrations/003`, `004`); the anon key alone cannot read or write anything without a valid session.
- Connector passwords encrypted at rest with AES-256-GCM (`src/lib/crypto.ts`), decrypted only server-side at connection time.
- Two roles (`profiles.role`: `admin` | `user`), enforced at both the API layer (`requireAdmin()` in `src/lib/supabase/server.ts`) and the database layer (`is_admin()` RLS policies, `supabase/migrations/006`) — redundant on purpose, so a bug in one layer doesn't remove the other.

### Connectors
- Real live-testing, schema introspection (`INFORMATION_SCHEMA`), and data preview for MS SQL Server, PostgreSQL, MySQL, and Supabase (`src/lib/db-test.ts`, `db-schema.ts`, `db-sync.ts`).
- SQL injection prevented via identifier allowlisting (`sanitizeIdentifier`), not string interpolation of user input.
- Other connector types (Oracle, DB2, Snowflake, Databricks, Iceberg, Salesforce, HubSpot, Stripe) can be recorded but honestly report "not implemented yet" for live features rather than faking a result.
- **Connector roles** (`connectors.role`: `source` | `target` | `both`, `supabase/migrations/009`) — set on the Add Connector form, shown as a badge on each card, and used to pre-filter the Source/Target connector dropdowns everywhere a pipeline picks connectors (New Pipeline modal, plus the additional-sources/destinations panel below).

### Pipelines, Canvas & Schema Mapping
- Visual pipeline canvas (`@xyflow/react`) with saved node/edge layout per pipeline.
- Schema mapping is a real deterministic heuristic (`src/lib/schema-mapper.ts`): normalized Levenshtein name similarity (75%) + type-category compatibility (25%), 0.35 confidence floor, greedy best-match assignment — explicitly not an LLM call.
- Pipeline delete (Canvas toolbar) — the API route existed from early on but no page ever called it; fixed.

### Sync Engine
- Synchronous, on-demand execution (`src/lib/db-sync.ts::runSync`, orchestrated by `src/lib/pipeline-actions.ts::runPipelineSync`), capped at 1,000 rows **total** per run (see Multi-Source below for how that cap applies with more than one source).
- Every run writes a real `sync_runs` row and, on success, a real `metering_events` row measuring actual serialized byte size transferred, summed across the primary target and every additional destination.
- No cron/queue — "Run" always means "run now, in this request."

#### Sync Mode: Append vs. Truncate & Reload
- `pipelines.sync_mode` (`append` | `truncate_reload`, `supabase/migrations/010`), set on the New Pipeline form.
- `truncate_reload` issues a real `TRUNCATE TABLE` against the target (per-driver: `truncateMssql`/`truncatePostgres`/`truncateMysql` in `db-sync.ts`) immediately before the insert — not before extraction — so a source-side failure never destroys the target's existing data.
- Fixes the real, confirmed defect where re-running any pipeline against a target with unique/primary keys failed with a duplicate-key error, since every run was a plain insert.

#### Multi-Source: UNION and JOIN (both built)
- `pipeline_sources` (`supabase/migrations/011`, extended by `013`) lets a pipeline have additional sources beyond its primary `source_id`/`source_table`, managed from Canvas → **Sources & Destinations**. Each additional source is `union` or `join` mode (`combine_mode`).
- **Union**: every union-mode source is extracted independently (capped at 1,000 rows by its own query) and concatenated (`UNION ALL` semantics, no dedup) onto the working row set.
- **Join**: each join-mode source is extracted in full (`extractAllColumns` — its useful columns aren't known in advance the way a union source's are) and merged into the working row set in memory, matched on a configured key (`join_column` on that source ↔ `primary_join_column` on the working set), `inner` or `left` (`join_type`). Primary-side fields win on name conflicts, so a join can enrich a row but never silently overwrite a column the schema mapping already resolved. Joins apply in the order added — chaining multiple join sources behaves like `A JOIN B JOIN C`. A real cross-engine SQL `JOIN` can't run here since sources may be on different physical database servers, so this is a genuine in-memory join, not a pushed-down query.
- The combined set (after all joins, then all unions) is capped at 1,000 rows before mapping/loading — a naive in-memory join of independently-extracted sets doesn't scale the way a database's own join planner would, so this remains a "small pipelines" feature.
- **Bug caught during verification, fixed before shipping**: the primary source's extraction query was originally restricted to the schema mapping's column list, which breaks when a mapped column actually lives on a *joined* source rather than the primary one (`SELECT region FROM orders` fails when `orders` has no `region` column). Fixed by extracting every column from the primary source whenever any join is configured, and letting the final remap step pick out whatever each mapping references regardless of which table it came from.
- **Verified live** with a real 3-database local Postgres setup (primary orders + a separate customers DB to join + a target): LEFT JOIN correctly enriched matched rows and kept the unmatched row with the joined column `NULL`; INNER JOIN correctly dropped that same unmatched row; a UNION-only pipeline was re-verified afterward as a regression check.

#### Filtered Multi-Target Push-Back, with multi-condition filters (built)
- `pipeline_destinations` (`supabase/migrations/012`, extended by `013`) lets a pipeline push a *filtered subset* of the same extracted+mapped rows to additional targets beyond the primary one — e.g. rows where `region = APAC` also go to a regional system.
- Filters are structured (column / operator / value — `matchesFilter()` in `db-sync.ts`, operators `= != > < >= <= contains`), not free-form SQL, so this can't reopen the injection surface the identifier allowlisting was built to close.
- A destination's first condition lives on `pipeline_destinations` itself; any additional conditions live in a child table `pipeline_destination_conditions`, combined per `match_mode`: `all` (AND — every condition must match) or `any` (OR — at least one must match). Managed inline per destination in the Canvas → **Sources & Destinations** panel (add/remove conditions, switch match mode).
- Filtering runs against the *raw extracted* rows (pre-column-mapping), then each destination gets the same column mapping applied to its filtered subset.
- **Verified live**: an AND condition (`region = APAC` and `amount > 90`) correctly matched only the one row satisfying both; an OR condition (`region = EMEA` or `amount > 90`) correctly matched every row satisfying either.
- `sync_runs.records`/the run's headline result stay scoped to the primary target; per-destination record/byte counts are summed into the metering event and mentioned in the audit log.

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
- `trigger_sync` automatically inherits sync mode, multi-source, and multi-destination behavior for free, since it calls the same `runPipelineSync` the UI uses.

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
- Pipeline delete had no UI entry point at all (API route existed, unused) — added to Canvas toolbar.
- Deleting a connector still referenced by a pipeline threw a raw Postgres foreign-key-violation error — now a clear 409 message telling you to delete the pipeline first.

### Pending: migrations not yet run
Five migrations were written this cycle and need to be run, in order
(Supabase SQL Editor), before their features work: `009_connector_role.sql`,
`010_pipeline_sync_mode.sql`, `011_pipeline_sources.sql`,
`012_pipeline_destinations.sql`, `013_join_and_multi_filter.sql`.

---

## Part 2 — Open Items

All three originally-requested features (sync mode, filtered multi-target
push-back with multi-condition filters, and multi-source UNION/JOIN) are
now built and verified. What's left:

- **Join key type reconciliation**: if a join key's underlying type differs across engines (e.g. `INT` on one side, `NUMERIC` or `VARCHAR` on the other), matching is done via string coercion (`String(value)`), which works for most cases but hasn't been stress-tested against, say, floating-point formatting differences or leading zeros.
- **Per-destination sync results aren't shown individually in the UI yet** — Progress Monitor/Scheduler only show the primary run's outcome. The data exists (`SyncResult.destinationResults`), just isn't surfaced.
- **Chained joins against evolving row sets**: joining source B then source C matches C against the *post-join-B* row set (real multi-way join chaining semantics, `A JOIN B JOIN C`), which is correct but means join order matters and isn't currently reorderable in the UI once added.
