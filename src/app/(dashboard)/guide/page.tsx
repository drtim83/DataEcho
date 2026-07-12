'use client';

import TopBar from '@/components/layout/TopBar';

const sections = [
  { id: 'getting-started', title: 'Getting Started', icon: '🚀' },
  { id: 'architecture', title: 'Architecture & Security', icon: '🛡️' },
  { id: 'connectors', title: 'Connectors', icon: '🔌' },
  { id: 'pipeline-canvas', title: 'Pipeline Canvas', icon: '🎨' },
  { id: 'schema-mapping', title: 'Schema Mapping', icon: '🧠' },
  { id: 'running-syncs', title: 'Running Syncs', icon: '⏱️' },
  { id: 'roles-team', title: 'Roles & Team', icon: '👥' },
  { id: 'billing', title: 'Billing & Metering', icon: '💳' },
  { id: 'mcp-tools', title: 'MCP Tools', icon: '🤖' },
  { id: 'demo-mode', title: 'Demo Mode', icon: '🎭' },
  { id: 'local-testing', title: 'Testing with a Local Database', icon: '🧪' },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: '🔧' },
  { id: 'faq', title: 'FAQ', icon: '❓' },
  { id: 'support', title: 'Support', icon: '✉️' },
];

export default function GuidePage() {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative">
      <TopBar title="User Guide & Documentation" subtitle="How DataEcho actually works, end to end" />

      <div className="flex flex-1 overflow-hidden">
        {/* TOC Sidebar */}
        <div className="w-64 p-6 hidden lg:block" style={{ borderRight: '1px solid var(--color-border-subtle)' }}>
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>Contents</h3>
          <ul className="space-y-2">
            {sections.map(s => (
              <li key={s.id}>
                <button
                  onClick={() => scrollToSection(s.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[rgba(255,255,255,0.05)] cursor-pointer"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="mr-2">{s.icon}</span> {s.title}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-12 pb-24">

            {/* Getting Started */}
            <section id="getting-started" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🚀</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Getting Started</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    <strong>DataEcho</strong> is a bidirectional data movement platform: connect two databases,
                    map their columns, and copy rows between them on demand. It&apos;s a real Next.js app backed
                    by Supabase (Postgres, Auth, Row Level Security) — every number on every page comes from a
                    real table, and every sync actually connects to a real database and moves real rows.
                  </p>
                  <p>
                    The typical flow: add two <strong>Connectors</strong> (Connector Hub) → build a{' '}
                    <strong>Pipeline</strong> between them (Pipeline Canvas) → compute a{' '}
                    <strong>Schema Mapping</strong> → click <strong>Run</strong>. Analytics, Metering, and the
                    Audit Trail all populate automatically from that real activity.
                  </p>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                    Not sure where to start? Visit <strong>Demo</strong> in the sidebar for a fully simulated
                    walkthrough of every screen with no real connectors or credentials involved.
                  </div>
                </div>
              </div>
            </section>

            {/* Architecture */}
            <section id="architecture" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🛡️</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Architecture & Security</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    DataEcho connects <strong>directly</strong> from its server (wherever the app is running —
                    your local dev server, or the deployed instance) to your database&apos;s host and port using
                    real drivers: <code>mssql</code>, <code>pg</code>, and <code>mysql2</code>. There is no
                    separate on-prem agent process and no tunnel — the database you connect just needs to be
                    reachable from wherever DataEcho itself is running.
                  </p>
                  <div className="p-4 my-6 rounded-xl" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)' }}>
                    <h4 className="font-bold mb-2 text-white">Practical implication:</h4>
                    <p>
                      A database on your laptop (<code>localhost</code> / <code>127.0.0.1</code>) is only
                      reachable while you&apos;re running DataEcho&apos;s own local dev server on that same
                      machine — the deployed (Netlify) instance runs in the cloud and cannot see your laptop.
                      A database behind a corporate firewall needs a route in (VPN, bastion, public endpoint
                      with IP allowlisting, etc.) from wherever DataEcho is deployed.
                    </p>
                  </div>
                  <p><strong>What&apos;s real about the security model:</strong></p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>Connector passwords are encrypted at rest with AES-256-GCM before being stored, and only decrypted server-side at the moment a connection is made.</li>
                    <li>Every table has Row Level Security enabled — reads/writes are only possible for authenticated users, enforced by Postgres itself, not just application code.</li>
                    <li>Connector, billing, and role-management mutations require the <code>admin</code> role, enforced both in the API route (<code>requireAdmin()</code>) and again at the database layer via an <code>is_admin()</code> RLS policy — a bug in one layer doesn&apos;t remove the other.</li>
                    <li>Auth is real Supabase email/password auth with session cookies — no mock login.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Connectors */}
            <section id="connectors" className="scroll-mt-24">
              <div className="glass-card p-8 border-l-4 border-l-[var(--color-accent-teal)]">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🔌</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Connectors</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    A connector stores a host, port, database name, username, and (encrypted) password for one
                    database. Live connection testing, schema introspection, and data preview are implemented
                    for four types:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Microsoft SQL Server</li>
                    <li>PostgreSQL</li>
                    <li>MySQL</li>
                    <li>Supabase (Postgres under the hood, with SSL enabled automatically)</li>
                  </ul>
                  <p>
                    Other types (Oracle, DB2, Snowflake, Databricks, Apache Iceberg, Salesforce, HubSpot,
                    Stripe) can be added as placeholder records, but clicking &ldquo;Test Connection&rdquo;
                    on them will honestly report &ldquo;not implemented yet&rdquo; rather than fake a result.
                  </p>
                  <p>
                    Only <strong>admins</strong> can add, test, or delete connectors — anyone signed in can view
                    the list and use <strong>Preview</strong> to browse a connector&apos;s real tables and the
                    first 25 rows of any table. Connection attempts time out after 8 seconds.
                  </p>
                </div>
              </div>
            </section>

            {/* Pipeline Canvas */}
            <section id="pipeline-canvas" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🎨</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Pipeline Canvas</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    A pipeline links one source connector + table to one target connector + table, with a
                    direction (cloud-bound, on-prem-bound, or bidirectional — used for cost categorization and
                    filtering, not for changing what a run actually does). The canvas visualizes it as a flow
                    diagram, and node positions/edges are saved per pipeline.
                  </p>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                    <strong>Honest limitation:</strong> you can drag <em>Transform</em> and <em>Filter</em>{' '}
                    annotation nodes onto the canvas, but they&apos;re visual only — clicking Run always
                    performs a direct, column-mapped copy from source to target. They don&apos;t currently
                    change sync behavior.
                  </div>
                </div>
              </div>
            </section>

            {/* Schema Mapping */}
            <section id="schema-mapping" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🧠</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Schema Mapping</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    Clicking <strong>Compute Mapping</strong> introspects both tables&apos; real columns (via
                    each database&apos;s <code>INFORMATION_SCHEMA</code>) and runs a deterministic heuristic
                    matcher — <strong>not an LLM call</strong>. For every source column it scores every unused
                    target column on:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Name similarity (75% weight) — normalized Levenshtein edit distance, so <code>first_name</code> and <code>FirstName</code> score highly.</li>
                    <li>Type compatibility (25% weight) — both columns fall into the same bucket: numeric, string, date, boolean, or other.</li>
                  </ul>
                  <p>
                    The best-scoring target above a 0.35 confidence floor is picked greedily and can&apos;t be
                    reused for another source column. A mismatched type bucket (e.g. mapping a numeric column
                    to a string column) still gets mapped, but with a warning banner so you can review it
                    before running the sync — nothing is silently coerced.
                  </p>
                </div>
              </div>
            </section>

            {/* Running Syncs */}
            <section id="running-syncs" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">⏱️</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Running Syncs</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    There is no background job queue or cron scheduler. Clicking <strong>Run</strong> (Canvas)
                    or <strong>Run Now</strong> (Scheduler) executes the sync synchronously, in the same
                    request: extract rows from the source, remap columns, insert into the target, and return
                    the result — capped at <strong>1,000 rows per run</strong> to keep it fast and predictable.
                  </p>
                  <p>
                    Every run writes a real <code>sync_runs</code> row (status, record count, timing) and, on
                    success, a real <code>metering_events</code> row measuring the actual serialized byte size
                    transferred — this is what feeds Analytics, Metering, and Stripe usage billing. A failed
                    run still gets logged with its error message, visible on the Progress Monitor page.
                  </p>
                </div>
              </div>
            </section>

            {/* Roles & Team */}
            <section id="roles-team" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">👥</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Roles & Team</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>There are two roles, stored per-account in a <code>profiles</code> table:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>admin</strong> — everything, including adding/testing/deleting connectors and managing billing.</li>
                    <li><strong>user</strong> — can view connectors, build and run pipelines, and map schemas, but cannot manage connectors or billing (those hold credentials and payment info).</li>
                  </ul>
                  <p>
                    New accounts are created in the Supabase dashboard (Authentication → Users → Add user), not
                    in the app — every new account defaults to <code>user</code> automatically via a database
                    trigger. An existing admin promotes accounts to admin on the <strong>Team</strong> page.
                    Admins can&apos;t demote themselves, to avoid ever locking everyone out.
                  </p>
                </div>
              </div>
            </section>

            {/* Billing */}
            <section id="billing" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">💳</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Billing & Metering</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    Billing runs on a real Stripe subscription (test mode) with a hybrid model:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>$25 / connector / month</strong> — a licensed subscription item whose quantity is kept in sync with your real connector count every time one is added or deleted.</li>
                    <li><strong>10 GB free, then $0.50 / GB</strong> — a metered subscription item. Every successful sync reports its real transferred bytes (converted to GB) as a Stripe meter event.</li>
                  </ul>
                  <p>
                    An admin adds a card on the <strong>Metering</strong> page via Stripe&apos;s hosted Payment
                    Element (DataEcho never sees or stores raw card numbers — only Stripe&apos;s customer,
                    payment method, and subscription IDs). Once a card is on file, the Metering page shows a
                    live <strong>Upcoming Invoice</strong> projection pulled straight from Stripe, reflecting
                    both the connector count and any metered usage so far this billing period.
                  </p>
                  <p>The rate card shown alongside is a separate, illustrative internal cost model (per-10K-rows / per-compute-minute) used for the Analytics &amp; Metering dashboards — it isn&apos;t tied to the Stripe price above.</p>
                </div>
              </div>
            </section>

            {/* MCP Tools */}
            <section id="mcp-tools" className="scroll-mt-24">
              <div className="glass-card p-8 border-l-4 border-l-[var(--color-accent-purple)]">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🤖</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>MCP Tools</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    DataEcho runs a real <strong>Model Context Protocol</strong> server (<code>/api/mcp</code>)
                    that any authenticated agent can drive. <code>GET /api/mcp</code> lists the available
                    tools; <code>POST /api/mcp</code> with <code>{'{ "tool": "...", "params": {...} }'}</code>{' '}
                    invokes one. Every tool call runs under your own session, so the same role and RLS rules
                    that govern the UI apply here too.
                  </p>
                  <div className="p-4 rounded-xl font-mono text-xs overflow-x-auto" style={{ background: '#000', color: '#0f0' }}>
                    curl -X POST /api/mcp \<br/>
                    &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br/>
                    &nbsp;&nbsp;-d {'\'{"tool":"list_connectors","params":{}}\''}
                  </div>
                  <ul className="list-disc list-inside space-y-1 ml-2 mt-4">
                    <li><code>list_connectors</code> — real connector list from the database.</li>
                    <li><code>preview_schema</code> — real column introspection for a connector/table.</li>
                    <li><code>map_schema</code> — runs the real heuristic mapper for a pipeline and saves it.</li>
                    <li><code>trigger_sync</code> — runs the real sync engine for a pipeline (same as clicking Run).</li>
                    <li><code>get_sync_status</code> — real status/record count for a given sync run.</li>
                    <li><code>get_analytics</code> — real platform-wide stats, same numbers as the Analytics page.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Demo Mode */}
            <section id="demo-mode" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🎭</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Demo Mode</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    The <strong>Demo</strong> page is entirely hardcoded, simulated data — connectors,
                    pipelines, sample tables, schedules, analytics, and metering that never touch your real
                    data. It exists purely for walkthroughs and sales demos where you don&apos;t want to risk
                    touching production connectors or billing. Click any connector card there to see a
                    simulated detail view of its tables.
                  </p>
                  <p>
                    The one deliberate exception is the <strong>&ldquo;Test Live Connection&rdquo;</strong>{' '}
                    button on the Supabase card, which runs one real, read-only query against DataEcho&apos;s
                    own Supabase database to prove the app is genuinely connected — clearly separate from the
                    simulated data around it.
                  </p>
                </div>
              </div>
            </section>

            {/* Local Testing */}
            <section id="local-testing" className="scroll-mt-24">
              <div className="glass-card p-8 border-l-4 border-l-[var(--color-accent-teal)]">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🧪</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Testing with a Local Database</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    The fastest way to prove a full sync end-to-end (connector → pipeline → mapping → run →
                    metering → billing) without touching any real production database is to spin up a
                    throwaway local Postgres, run one real sync against it, then tear it down. This only works
                    against DataEcho&apos;s own local dev server (<code>localhost:3000</code>), not a deployed
                    instance — see <em>Architecture &amp; Security</em> above.
                  </p>
                  <div className="p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-1" style={{ background: '#000', color: '#0f0' }}>
                    <div># 1. Install & start Postgres locally</div>
                    <div>brew install postgresql@16</div>
                    <div>brew services start postgresql@16</div>
                    <div className="mt-2"># 2. Create a source DB with sample data and an empty target DB</div>
                    <div>createdb dataecho_source</div>
                    <div>createdb dataecho_target</div>
                    <div>psql -d dataecho_source -c &quot;CREATE TABLE customers (id serial primary key, name text, email text);&quot;</div>
                    <div>psql -d dataecho_source -c &quot;INSERT INTO customers (name,email) SELECT &apos;C&apos;||g, &apos;c&apos;||g||&apos;@x.com&apos; FROM generate_series(1,200) g;&quot;</div>
                    <div>psql -d dataecho_target -c &quot;CREATE TABLE customers (id serial primary key, name text, email text);&quot;</div>
                  </div>
                  <p>Then, in the app at <code>localhost:3000</code>:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Connector Hub → add two connectors, both host <code>127.0.0.1</code>, port <code>5432</code>, databases <code>dataecho_source</code> / <code>dataecho_target</code>, your macOS username, blank password (fresh Homebrew Postgres trusts local connections).</li>
                    <li>Canvas → New Pipeline using those two connectors and the <code>customers</code> table on each side.</li>
                    <li>Schema Mapping → Compute Mapping for that pipeline.</li>
                    <li>Canvas or Scheduler → Run. Check Progress Monitor, Analytics, and Metering for the real result.</li>
                  </ol>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <strong>Clean up afterward</strong> so this throwaway infrastructure doesn&apos;t linger:
                    delete the two test connectors and pipeline in the app, then <code>dropdb dataecho_source dataecho_target</code>{' '}
                    and <code>brew services stop postgresql@16</code> (or <code>brew uninstall postgresql@16</code>{' '}
                    if you don&apos;t need it again).
                  </div>
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section id="troubleshooting" className="scroll-mt-24">
              <div className="glass-card p-8 border-l-4 border-l-[var(--color-accent-coral)]">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🔧</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Troubleshooting</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <div className="grid gap-4">
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">&ldquo;Connection timed out&rdquo; when testing a connector</h4>
                      <p>The app couldn&apos;t reach the host/port within 8 seconds. Confirm the database is reachable from wherever DataEcho is running right now (see Architecture &amp; Security) — a firewall, VPN, or wrong host/port is the usual cause.</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">&ldquo;Only admins can manage connectors&rdquo; (403)</h4>
                      <p>Your account&apos;s role is <code>user</code>. Ask an existing admin to promote you on the Team page.</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">A sync only moved part of a large table</h4>
                      <p>Runs are capped at 1,000 rows by design, to keep each synchronous request fast and predictable. Click Run again to pull the next batch, or filter the source table down before mapping.</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">&ldquo;No schema mapping exists for this pipeline yet&rdquo;</h4>
                      <p>Run Compute Mapping on the Schema Mapping page for that pipeline before clicking Run — a sync needs to know which source columns go to which target columns.</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">Metering shows records but the upcoming invoice doesn&apos;t change</h4>
                      <p>No payment method is on file yet — until a card is added on the Metering page, there&apos;s no Stripe subscription to report usage against. The internal cost/records numbers still track correctly either way.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">❓</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>FAQ</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <div className="grid gap-4">
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">Is this actually connecting to my database, or just a demo?</h4>
                      <p>Every page except <strong>Demo</strong> is real: real connectors, real credentials (encrypted at rest), real sync runs, real Stripe billing. Demo is the one page that&apos;s entirely simulated, clearly labeled as such.</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">If I run the same pipeline twice, does it overwrite the target or create duplicates?</h4>
                      <p>Today, every run is a plain insert — running the same pipeline twice against a target that enforces unique keys (e.g. a primary key) will fail on the second run with a duplicate-key error, since nothing is deleted or upserted first. An explicit &ldquo;Append&rdquo; vs. &ldquo;Truncate &amp; Reload&rdquo; sync mode is on the roadmap; for now, either target a table without conflicting keys or clear it yourself between runs.</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">Can I join or union multiple sources into one target, or filter data out to different targets by region/LOB?</h4>
                      <p>Not yet — today a pipeline is strictly one source table to one target table, direct column-mapped copy. Multi-source joins/unions and filtered fan-out to multiple targets are on the roadmap; ask in the app if you&apos;d like one prioritized.</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">Do I need to add a credit card to use DataEcho?</h4>
                      <p>No — connectors, pipelines, schema mapping, and syncing all work without a payment method. Adding a card (admin-only, Metering page) is only required to keep a subscription active for billing purposes.</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">Which database types are actually supported today?</h4>
                      <p>Live connection testing, schema browsing, and syncing work for Microsoft SQL Server, PostgreSQL, MySQL, and Supabase. Other types can be added as records but are labeled &ldquo;not implemented yet&rdquo; for live features.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Support */}
            <section id="support" className="scroll-mt-24">
              <div className="glass-card p-8 border-l-4 border-l-[var(--color-accent-blue)]">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">✉️</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Support</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    Questions, bug reports, or feature requests — reach out at{' '}
                    <a href="mailto:support@dataecho.com" className="font-medium" style={{ color: 'var(--color-accent-blue)' }}>support@dataecho.com</a>.
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
