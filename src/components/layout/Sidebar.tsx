'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ────────── Clean SVG Icons (Lucide-style, 20×20) ────────── */
const icons: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  pipeline: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h10M5 8v4a4 4 0 0 0 4 4h2M19 8v4a4 4 0 0 1-4 4h-2" />
    </svg>
  ),
  connector: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  schema: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  scheduler: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  monitor: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  analytics: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  metering: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  audit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  team: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  demo: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  guide: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  collapse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  ),
  chevronLeft: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  chevronRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
};

const navItems = [
  { href: '/', label: 'Command Center', icon: 'dashboard' },
  { href: '/canvas', label: 'Pipeline Canvas', icon: 'pipeline' },
  { href: '/connectors', label: 'Connector Hub', icon: 'connector' },
  { href: '/schema', label: 'Schema Mapping', icon: 'schema' },
  { href: '/scheduler', label: 'Scheduler', icon: 'scheduler' },
  { href: '/monitor', label: 'Progress Monitor', icon: 'monitor' },
  { href: '/analytics', label: 'Analytics & Stats', icon: 'analytics' },
  { href: '/metering', label: 'Metering', icon: 'metering' },
  { href: '/logs', label: 'Audit Trail', icon: 'audit' },
  { href: '/team', label: 'Team', icon: 'team' },
  { href: '/demo', label: 'Demo', icon: 'demo' },
  { href: '/guide', label: 'User Guide', icon: 'guide' },
];

export default function Sidebar({ userEmail, role }: { userEmail: string; role: 'admin' | 'user' }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const sidebarWidth = collapsed ? '72px' : '240px';

  return (
    <>
      {/* Spacer to push main content */}
      <div style={{ width: sidebarWidth, flexShrink: 0, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />

      <aside
        className="fixed left-0 top-0 bottom-0 flex flex-col z-50"
        style={{
          width: sidebarWidth,
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--color-border-subtle)',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Logo + Collapse Toggle */}
        <div className="px-3 py-4 flex items-center justify-between" style={{ minHeight: '64px' }}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 animate-gradient"
              style={{ background: 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-teal))', backgroundSize: '200% 200%' }}>
              D
            </div>
            {!collapsed && (
              <div className="whitespace-nowrap">
                <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>DataEcho</h1>
                <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Enterprise</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:scale-110"
            style={{ color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.04)' }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? icons.chevronRight : icons.chevronLeft}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--color-accent-blue)' : '2px solid transparent',
                }}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0" style={{ color: isActive ? 'var(--color-accent-blue)' : 'var(--color-text-muted)', opacity: isActive ? 1 : 0.7 }}>
                  {icons[item.icon]}
                </span>
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          {!collapsed && (
            <div className="text-center pb-2 mb-1" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Created by</p>
              <p className="text-xs font-bold text-gradient mt-0.5">Dr. Timothy Tok</p>
            </div>
          )}
          <div className={`flex items-center gap-3 px-2 mb-1 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-accent-purple), var(--color-accent-blue))' }}>
              {userEmail.charAt(0).toUpperCase() || '?'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{userEmail}</p>
                <span className={`badge text-[9px] px-1.5 py-0 mt-0.5 ${role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>{role}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${collapsed ? 'justify-center' : ''}`}
            style={{ color: 'var(--color-text-muted)', background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = 'var(--color-accent-coral)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
