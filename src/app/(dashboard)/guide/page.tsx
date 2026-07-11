'use client';

import TopBar from '@/components/layout/TopBar';

const sections = [
  { id: 'getting-started', title: 'Getting Started', icon: '🚀' },
  { id: 'architecture', title: 'Architecture & Security', icon: '🛡️' },
  { id: 'mcp-agent', title: 'MCP On-Prem Agent', icon: '🔌' },
  { id: 'pipeline-canvas', title: 'Pipeline Canvas', icon: '🎨' },
  { id: 'ai-schema', title: 'AI Schema Mapping', icon: '🧠' },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: '🔧' }
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
      <TopBar title="User Guide & Documentation" subtitle="Learn how to use DataEcho Enterprise" />

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
                    Welcome to <strong>DataEcho Enterprise</strong>, created by Dr. Timothy Tok.
                    DataEcho is a next-generation bidirectional data platform designed to bridge the gap between secure on-premise databases and cloud-native applications using AI.
                  </p>
                  <p>
                    Unlike traditional ETL tools that require complex VPNs or opening firewall ports, DataEcho leverages the <strong>Model Context Protocol (MCP)</strong> to securely extract, transform, and load data without exposing your internal network to the internet.
                  </p>
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
                    DataEcho operates on a <strong>hub-and-spoke</strong> security model. The cloud application (hub) never initiates connections into your network. Instead, you deploy a lightweight MCP Agent (spoke) inside your firewall.
                  </p>
                  
                  <div className="p-4 my-6 rounded-xl" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)' }}>
                    <h4 className="font-bold mb-2 text-white">How it works:</h4>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>The <strong>MCP Agent</strong> runs on a server inside your corporate network.</li>
                      <li>It establishes a secure outbound WebSocket/HTTPS connection to DataEcho Cloud.</li>
                      <li>DataEcho Cloud requests actions (e.g., "extract rows from Table X") via this open tunnel.</li>
                      <li>The Agent queries the local database and streams the results back out.</li>
                    </ol>
                  </div>
                  
                  <p>
                    This means <strong>no inbound ports need to be opened</strong>, satisfying stringent enterprise infosec requirements.
                  </p>
                </div>
              </div>
            </section>

            {/* MCP Agent */}
            <section id="mcp-agent" className="scroll-mt-24">
              <div className="glass-card p-8 border-l-4 border-l-[var(--color-accent-teal)]">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🔌</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Deploying the MCP Agent</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>To connect to an on-premise database (e.g., SQL Server, Oracle), you must deploy the agent:</p>
                  
                  <div className="p-4 rounded-xl font-mono text-xs overflow-x-auto" style={{ background: '#000', color: '#0f0' }}>
                    $ git clone https://github.com/dataecho/mcp-agent.git<br/>
                    $ cd mcp-agent<br/>
                    $ npm install<br/>
                    $ export DATAECHO_API_KEY="your-secret-key"<br/>
                    $ export DB_CONNECTION_STRING="Server=10.0.1.50;Database=HR;User=sa;Password=secret"<br/>
                    $ npm start
                  </div>

                  <p className="mt-4">
                    Once running, the agent will appear as "Live" in the Connector Hub, and you can begin building pipelines.
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
                    The Pipeline Canvas is a visual node-based editor for designing data flows. 
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Source Nodes:</strong> Define where data comes from (e.g., On-Prem SQL).</li>
                    <li><strong>Transform Nodes:</strong> Apply filters, joins, or AI schema mapping.</li>
                    <li><strong>Destination Nodes:</strong> Define where data goes (e.g., Snowflake, BigQuery).</li>
                  </ul>
                  <p>Drag nodes from the left panel onto the canvas and connect their handles to establish the flow of data.</p>
                </div>
              </div>
            </section>

            {/* AI Schema */}
            <section id="ai-schema" className="scroll-mt-24">
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🧠</span>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>AI Schema Mapping</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>
                    DataEcho uses LLMs to automate tedious data mapping tasks. When connecting two disparate systems (e.g., a legacy CRM to Salesforce), the AI analyzes column names, data types, and sample values to suggest mappings.
                  </p>
                  <p>
                    For example, it knows that <code>FIRST_NM</code> in System A corresponds to <code>FirstName</code> in System B, and that <code>DOB</code> (string) should be cast to a <code>DateTime</code> object. You can review and approve these suggestions in the Schema Mapping tab.
                  </p>
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
                      <h4 className="font-bold text-white mb-1">Agent disconnected?</h4>
                      <p>Check the host machine's outbound internet access on port 443. The agent requires HTTPS access to DataEcho Cloud.</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <h4 className="font-bold text-white mb-1">Pipeline stuck in 'Running'?</h4>
                      <p>Check the Audit Trail (Logs). A large batch extract might be queuing, or a destination API rate limit may have been hit.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
