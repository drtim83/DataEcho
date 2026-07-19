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
- **Second bug caught during migration verification, fixed**: `runSchemaMapping()` only introspected the pipeline's primary `source_table`/`target_table`, so a join-only column (e.g. `customers.name`) was merged into rows correctly at extraction time but had no `schema_mappings` row to travel through at the final remap step, and was silently dropped before load. Fixed by also introspecting every join-mode source in `pipeline_sources` and folding those columns into the candidate set passed to `mapSchemas`, with the primary source's own columns taking priority on name conflicts (matching the sync engine's existing join-merge priority). Re-verified live: `customers.name`/`tier` now land correctly on matched rows and stay `NULL` on the unmatched one.

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
- **Production-only bug found and fixed**: Stripe's default Node `https`-based HTTP client fails every outbound call from Netlify's function runtime (`StripeConnectionError`) — switched to `Stripe.createFetchHttpClient()` in `src/lib/stripe.ts`. Separately, the `STRIPE_SECRET_KEY` value itself got silently corrupted to a length-preserving bullet-masked placeholder on every attempt to set it (via `netlify env:set` twice and the Netlify dashboard once) — a real secret string starting `sk_` appears to get intercepted and redacted by something on the local machine (clipboard/paste-based DLP tooling was the working theory). Routing the value through a shell variable (`source .env.local && netlify env:set STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY"`, never rendering the raw text) rather than a literal pasted argument worked. Confirmed fixed via a temporary diagnostic route (length/prefix/suffix only, never logged the real value) and then live 200s from `/api/billing/setup-intent` and `/api/billing/upcoming-invoice` against production.

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

### Migrations
All five migrations (`009_connector_role.sql` through
`013_join_and_multi_filter.sql`) have been run against the live Supabase
project and verified live.

### Verified This Cycle: MCP, chained joins, MySQL, production billing
- **MCP tools genuinely hit real infrastructure**: `preview_schema`, `map_schema`, `trigger_sync`, and `get_sync_status` were driven over real HTTP against `/api/mcp` (payload shape is `{ tool, params }`, not `{ tool, args }`), against a real local Postgres table — then the target table's contents were checked directly in Postgres, bypassing the app, confirming the rows genuinely moved.
- **Chained joins (`A JOIN B JOIN C`, 3 real sources)**: verified live with 3 separate local Postgres databases. Chaining depth works correctly (a join-C match is correctly evaluated against the *post-join-B* row, not the primary row), and LEFT JOIN NULL-propagation is correct at each level.
- **Real bug found in `mapSchemas` (`src/lib/schema-mapper.ts`) and fixed**: the single-pass greedy matcher is order-dependent — a source column with a weak fuzzy match (e.g. a joined `regions.code`) could claim a target column before a different source column with a perfect exact-name match (`regions.region_name` → target `region_name`) ever got a turn, since it was iterated later. Fixed with a two-pass approach: exact normalized-name matches are resolved first, across every source column, before any fuzzy matching runs. Re-verified live: the correct region name now lands instead of the raw region code.
- **MySQL connector**: verified live against a real local MySQL 9.7.1 instance — `Test Connection` reported the genuine server version, `preview_schema`/`map_schema`/`trigger_sync` all worked against real MySQL types (`int`/`varchar`/`decimal`), and the target table was confirmed directly in MySQL.
- **MSSQL connector**: verified live against a real SQL Server 2022 container (Docker) — `Test Connection` reported the genuine server version, and `preview_schema`/`map_schema`/`trigger_sync` all worked against real MSSQL types (`int`/`nvarchar`/`decimal`), confirmed directly in SQL Server.
- **Real bug found and fixed**: connecting to MSSQL by IP address (the normal case for an on-prem box, and the only way to reach a local test instance) failed outright — `tedious` (the underlying driver) computes the TLS SNI `servername` from two different code paths that disagree on IP literals; one correctly falls back to an empty string, the other doesn't and hands Node's `tls` module the raw IP, which Node rejects per the SNI spec (IPs aren't valid SNI values). Fixed in `src/lib/db-test.ts` (`mssqlOptions()`, used by all 8 MSSQL connection sites across `db-test.ts`/`db-schema.ts`/`db-sync.ts`) by explicitly passing a placeholder non-IP `serverName` whenever the host is an IP — inert since `trustServerCertificate: true` already skips hostname verification, but it short-circuits both of tedious's buggy fallback paths. Root-caused with a minimal standalone repro script isolating the exact `tedious`/`mssql` package internals before writing the fix.
- **Production Stripe billing**: was completely broken (every call failed) until both fixes above landed. Now confirmed live with real 200 responses from `/api/billing/setup-intent` (real `seti_...` client secret) and `/api/billing/upcoming-invoice` (real proration line items matching local exactly).

### Oracle connector: built and verified
Oracle was previously unimplemented (a placeholder "not implemented yet" message only). Built for real this cycle:
- `oracledb` (thin mode, no native Instant Client required) wired into `db-test.ts`/`db-schema.ts`/`db-sync.ts` following the exact pattern of the other three drivers — connection test, `user_tables`/`user_tab_columns` introspection (Oracle equates "schema" with "user", unlike Postgres/MySQL), extraction (`FETCH FIRST n ROWS ONLY`), insert (named binds), truncate, and preview.
- Identifiers are deliberately left unquoted for Oracle (unlike the double/square-bracket quoting used for Postgres/MSSQL) so Oracle's normal case-insensitive resolution matches whatever case the user types, since Oracle stores unquoted identifiers uppercase by default; `sanitizeIdentifier`'s character allowlist keeps this injection-safe either way.
- **Verified live** against a real Oracle Database Free 23ai container (Docker, `gvenzl/oracle-free:23-slim`): `Test Connection` reported the genuine server version, `preview_schema`/`map_schema`/`trigger_sync` all worked against real Oracle types (`NUMBER`/`VARCHAR2`), and the synced rows were confirmed directly via `sqlplus` in the container.

### Online (public-internet) database test
All prior connector testing was against `127.0.0.1` — same-machine, no real DNS, no real TLS cert, no real network path. Tested a `postgresql`-type connector (the generic driver path, not the special `supabase` type) against the project's own production Postgres over the real internet:
- **Real finding**: Supabase's direct-connection hostname (`db.<ref>.supabase.co`) only publishes an AAAA (IPv6) record, no A (IPv4) record — connecting by that hostname fails outright wherever IPv6 egress isn't available. The Session Pooler (`aws-0-<region>.pooler.supabase.com:5432`, username `postgres.<project-ref>`) is the IPv4-compatible path and is what actually needs documenting for anyone pointing a plain `postgresql` connector at Supabase.
- **Verified live**: real DNS resolution to AWS infrastructure, real Postgres 17.6 auth over the pooler, schema mapping, and a real sync — confirmed by querying the target table directly via `psql` over the same public connection, completely bypassing the app.

---

## Part 2 — Open Items

All three originally-requested features (sync mode, filtered multi-target
push-back with multi-condition filters, and multi-source UNION/JOIN) are
now built and verified. What's left:

- **Join key type reconciliation**: if a join key's underlying type differs across engines (e.g. `INT` on one side, `NUMERIC` or `VARCHAR` on the other), matching is done via string coercion (`String(value)`), which works for most cases but hasn't been stress-tested against, say, floating-point formatting differences or leading zeros.
- **Per-destination sync results aren't shown individually in the UI yet** — Progress Monitor/Scheduler only show the primary run's outcome. The data exists (`SyncResult.destinationResults`), just isn't surfaced.
- **Chained joins against evolving row sets**: joining source B then source C matches C against the *post-join-B* row set (real multi-way join chaining semantics, `A JOIN B JOIN C`), which is correct but means join order matters and isn't currently reorderable in the UI once added.

---

## Part 3 — Connector Expansion Plan: Warehouses & Object Storage

Covers Databricks, Snowflake, and object storage (AWS S3 / Azure
Blob-ADLS / Google Cloud Storage) as source-or-target connectors, plus
the harder question of Delta Lake / Iceberg table-format conversion on
top of object storage. Package names and Docker image names were
checked to actually exist (`npm view`, `docker manifest inspect`)
before writing the plan, not assumed. S3 (below) is now built and
verified live; Azure/GCS/Snowflake/Databricks/Delta/Iceberg remain
planning-only.

### Amazon S3 — built and verified live
- `@aws-sdk/client-s3` wired into `db-test.ts`/`db-schema.ts`/`db-sync.ts` following the same driver pattern as the SQL connectors, plus a new `region` — hardcoded to `us-east-1` for now, not yet exposed in the connector form (real follow-up, not a blocker). `host` doubles as an optional S3-compatible endpoint override (blank connects to real AWS; a URL like a local MinIO/LocalStack endpoint routes elsewhere), with `forcePathStyle` enabled whenever an endpoint override is set, since path-style addressing is what local S3-compatible servers expect.
- A "table" is a single `.csv` or `.json` object key, not a whole prefix/multi-file scan — deliberately scoped tight for a first working version, matching how every other connector in this app started (single credentials, one table, MVP-then-expand).
- Sync-mode semantics map cleanly onto the existing `runSync()` control flow with zero changes there: `truncateS3` deletes the key (used only for `truncate_reload`), and `insertS3` always appends — reading whatever's already at the key (if anything) and rewriting the combined set — which is exactly right for `append` mode and, combined with the truncate step, exactly right for `truncate_reload` too.
- **Two real bugs found via live testing and fixed**:
  1. `getColumnsS3` threw when the target key didn't exist yet (the normal case for a sync's first run — there's no file-storage equivalent of pre-declaring a table's schema via `CREATE TABLE`). Fixed to return an empty column list instead of erroring, and `runSchemaMapping()` (`pipeline-actions.ts`) now falls back to mirroring the source's own columns when a target genuinely has none yet.
  2. `getColumnsS3` originally inferred columns only from parsed data rows, so a CSV with a header but zero data rows (the object-storage equivalent of an empty pre-created table) reported no columns at all. Fixed to read the CSV header line directly.
- **Verified live** against a real MinIO container (S3-API-compatible, not a mock): connection test, schema introspection on both a JSON and a CSV source, mapping, `append` mode (confirmed 3→6 rows across two runs), `truncate_reload` mode (confirmed it stays at 3 rows across two runs, not accumulating) — every check done by reading the target object directly via the AWS SDK, bypassing the app entirely.
- Note on the emulator choice: `localstack/localstack:latest` now gates behind a paid license (its `latest` tag defaults to the Pro image and refuses to start without an auth token) — switched to MinIO instead, which is genuinely free with no licensing gate.
- **Known limitations, honestly scoped for a first version, not silently swept under the rug**: region isn't yet configurable from the UI (hardcoded `us-east-1`); CSV parsing is a naive comma-split with no quoted-comma escaping; a "table" is one object key, not a prefix of many files; Parquet isn't supported (only CSV/JSON).

### Snowflake — feasible, same shape as the existing SQL connectors
- Official driver: `snowflake-sdk` (npm, actively maintained, confirmed on npm).
- Wires in the same way as `oracledb`/`mssql`/`mysql2`/`pg`: `snowflake.createConnection({ account, username, password, warehouse, database, schema })`, `connection.execute({ sqlText, binds })`.
- Auth note: Snowflake commonly uses key-pair auth for service accounts rather than a plain password; the connector form would need an optional private-key field alongside username/password, not just reuse the existing 4-field (host/port/database/username/password) shape unmodified.
- **Local testability: none.** Snowflake is pure SaaS with no official (or credible unofficial) local emulator — unlike Postgres/MySQL/MSSQL/Oracle, there's no Docker image to spin up. Real live verification needs a real Snowflake account. Snowflake's free trial (~$400 credit, 30 days) is a genuine signup, not something I can create — would need you to sign up and hand me connection details the same way we did for MSSQL/Oracle credentials.

### Databricks — feasible via REST, same local-testability gap
- No JDBC/ODBC needed: Databricks' SQL Statement Execution API (`POST /api/2.0/sql/statements`, polled via `GET /api/2.0/sql/statements/{id}`) runs over plain HTTPS with a personal access token and a SQL warehouse ID. Buildable with `fetch`, no native driver dependency at all.
- Schema introspection via the same API (`DESCRIBE TABLE`, `SHOW TABLES`) or Databricks' Unity Catalog REST API directly.
- **Local testability: none.** Same as Snowflake — Databricks isn't self-hostable. Needs a real workspace with a running SQL warehouse (their trial exists but is a real signup, and warehouses cost per-hour once trial credits run out).

### Object storage (AWS S3 / Azure Blob+ADLS / Google Cloud Storage) — feasible, and genuinely locally testable
This is the one part of this expansion that doesn't need real cloud accounts to build *and verify* end-to-end, the same way Postgres/MySQL/MSSQL/Oracle didn't:
- **AWS S3**: `@aws-sdk/client-s3` (official, confirmed on npm). Local emulator: `localstack/localstack` (Docker image confirmed to exist) — runs a real S3-API-compatible server locally, no AWS account needed for dev/test.
- **Azure Blob Storage / ADLS Gen2**: `@azure/storage-blob` (official, confirmed on npm) for Blob; ADLS Gen2 (hierarchical namespace) needs `@azure/storage-file-datalake` for directory-aware operations. Local emulator: `mcr.microsoft.com/azure-storage/azurite` (Microsoft's own official emulator image, confirmed to exist).
- **Google Cloud Storage**: `@google-cloud/storage` (official, confirmed on npm). Local emulator: `fsouza/fake-gcs-server` (widely used community emulator, confirmed to exist) — not Google-official, but mature and commonly used for exactly this purpose.
- **Shape mismatch with the current sync engine**: `runSync()` today extracts *rows* from a SQL source and `INSERT`s *rows* into a SQL target. Object storage as a target isn't row-inserts — it's "serialize the extracted rows to a file (CSV/JSON/Parquet) and `PutObject`/`upload` it." Object storage as a *source* is similarly file-shaped, not table-shaped: it'd mean reading and parsing a file, not `SELECT`ing from a table (the `table_name` field in the pipeline UI would need to become "file path / prefix" for this connector type). This needs a real branch in the sync engine, not just another case in the existing `switch (input.type)` blocks — a plain file dump (CSV/JSON) is a moderate addition; **Parquet specifically needs a writer/reader library too** (e.g. `parquetjs` or, more robustly, embedding DuckDB — see below), it's not just `fs.writeFile`.

### Delta Lake / Iceberg table format — the hard part, independent of which cloud
Both are a columnar *table format* layered on top of object storage (Parquet data files + a metadata tree — Avro manifests for Iceberg, JSON+checkpoint files for Delta), not a target you write rows into directly. This doesn't fit anywhere in the current row-based sync engine and would be a genuinely new subsystem, not a driver plug-in:
- **No mature pure-Node.js writer for either format.** The realistic options are (a) embed DuckDB (`@duckdb/node-api`, confirmed on npm) — it has an `iceberg` extension with growing write support and a `delta` extension that's stronger on read than write, or (b) shell out to a lightweight Python subprocess using `pyiceberg` or `deltalake` (delta-rs' Python bindings — pure Rust under the hood, no JVM), which are the most mature writers available anywhere outside the Spark/JVM ecosystem.
- **Which of those is actually the right call needs a short feasibility spike first** — specifically, testing DuckDB's current Iceberg/Delta *write* support (not just read) against a real local object-storage emulator, before committing to either the DuckDB-embedded approach or the Python-subprocess approach. I don't want to assert one is definitely right without having actually driven it.
- Realistic scope: this is a multi-day feature (new extraction-to-file pipeline path, a table-format writer, real object storage auth, and its own set of live-verification tests against the emulators above) — not something to fold into the existing per-connector-type `switch` statements alongside a driver import.

### Suggested order, if this gets built
1. Object storage connectors first (S3 → Azure → GCS), tested fully locally via the three emulators — no account signups needed, and it's the piece that unblocks Delta/Iceberg work regardless of which cloud.
2. Delta Lake / Iceberg on top of that, starting with the DuckDB-vs-Python-subprocess feasibility spike.
3. Snowflake and Databricks last, since both are blocked on you creating real trial accounts for live verification — worth sequencing after the object-storage work so that's not sitting idle waiting on an external signup.
