'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/', label: 'Command Center', icon: '📊' },
  { href: '/canvas', label: 'Pipeline Canvas', icon: '🎨' },
  { href: '/connectors', label: 'Connector Hub', icon: '🔌' },
  { href: '/schema', label: 'Schema Mapping', icon: '🧠' },
  { href: '/scheduler', label: 'Scheduler', icon: '⏰' },
  { href: '/monitor', label: 'Progress Monitor', icon: '📡' },
  { href: '/analytics', label: 'Analytics & Stats', icon: '📈' },
  { href: '/metering', label: 'Metering', icon: '💰' },
  { href: '/logs', label: 'Audit Trail', icon: '📋' },
  { href: '/team', label: 'Team', icon: '👥' },
  { href: '/demo', label: 'Demo', icon: '🎭' },
  { href: '/guide', label: 'User Guide', icon: '📖' },
];

export default function Sidebar({ userEmail, role }: { userEmail: string; role: 'admin' | 'user' }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full reload so the proxy sees the cleared session cookie.
    window.location.href = '/login';
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] flex flex-col z-50"
      style={{ background: 'rgba(17, 24, 39, 0.95)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--color-border-subtle)' }}>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold animate-gradient"
          style={{ background: 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-teal))', backgroundSize: '200% 200%' }}>
          D
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>DataEcho</h1>
          <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Enterprise</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="text-base" style={{ filter: isActive ? 'brightness(1.2)' : 'none' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="text-center pb-2 mb-2" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Created by</p>
          <p className="text-xs font-bold text-gradient mt-0.5">Dr. Timothy Tok</p>
        </div>
        <div className="flex items-center gap-3 px-3 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-purple), var(--color-accent-blue))' }}>
            {userEmail.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{userEmail}</p>
            <span className={`badge text-[9px] px-1.5 py-0 mt-0.5 ${role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>{role}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer"
          style={{ color: 'var(--color-text-muted)', background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = 'var(--color-accent-coral)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  );
}
