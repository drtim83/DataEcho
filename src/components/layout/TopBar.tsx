interface TopBarProps {
  title: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header className="h-16 flex items-center justify-between px-8 sticky top-0 z-40"
      style={{ background: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div className="animate-fade-in">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
        {subtitle && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <span className="text-sm">🔔</span>
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse-subtle"
            style={{ background: 'var(--color-accent-coral)', color: 'white' }}>
            3
          </span>
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(20, 184, 166, 0.1)' }}>
          <span className="status-dot connected"></span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-accent-teal)' }}>Live</span>
        </div>
      </div>
    </header>
  );
}
