'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] flex flex-col z-50"
      style={{ background: 'rgba(17, 24, 39, 0.95)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--color-border-subtle)' }}>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold"
          style={{ background: 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-teal))' }}>
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--color-accent-blue)' : '3px solid transparent',
              }}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-purple), var(--color-accent-blue))' }}>
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>Admin</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>admin@dataecho.app</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
