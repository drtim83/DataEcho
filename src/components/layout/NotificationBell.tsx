'use client';

import { useEffect, useState, useRef } from 'react';

interface Notification {
  id: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Load notifications from audit logs when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/audit-logs?limit=10')
      .then((r) => r.json())
      .then((data) => {
        const logs = data.logs || [];
        const mapped: Notification[] = logs.map((log: { id: string; action: string; actor: string; status: string; details: string; timestamp: string }, i: number) => ({
          id: log.id || String(i),
          icon: getIcon(log.action, log.status),
          title: formatAction(log.action),
          detail: log.details || `${log.actor} — ${log.status}`,
          time: timeAgo(log.timestamp),
          read: i > 2,
        }));
        setNotifications(mapped.length > 0 ? mapped : getDefaultNotifications());
      })
      .catch(() => {
        setNotifications(getDefaultNotifications());
      })
      .finally(() => setLoading(false));
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
        style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
      >
        <span className="text-sm">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse-subtle"
            style={{ background: 'var(--color-accent-coral)', color: 'white' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-96 rounded-xl overflow-hidden glass-strong z-50 animate-fade-in-scale"
          style={{ border: '1px solid var(--color-border-subtle)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Notifications</h4>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] font-medium cursor-pointer" style={{ color: 'var(--color-accent-blue)' }}>
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 transition-colors"
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    background: n.read ? 'transparent' : 'rgba(59, 130, 246, 0.04)',
                  }}
                >
                  <span className="text-base mt-0.5">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: n.read ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>
                      {n.title}
                    </p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{n.detail}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{n.time}</span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent-blue)' }} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <a href="/logs" className="text-[11px] font-medium" style={{ color: 'var(--color-accent-blue)' }}>
              View all in Audit Trail →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function getIcon(action: string, status: string): string {
  if (status === 'error' || status === 'failure') return '❌';
  if (action?.includes('connector')) return '🔌';
  if (action?.includes('pipeline')) return '🔗';
  if (action?.includes('sync') || action?.includes('run')) return '🔄';
  if (action?.includes('billing') || action?.includes('payment')) return '💳';
  if (action?.includes('role') || action?.includes('profile')) return '👤';
  if (action?.includes('schema')) return '🧠';
  return '📋';
}

function formatAction(action: string): string {
  if (!action) return 'Activity';
  return action
    .replace(/\./g, ' › ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getDefaultNotifications(): Notification[] {
  return [
    { id: '1', icon: '🔌', title: 'Connector Connected', detail: 'HR SQL Server is online and healthy', time: '2m ago', read: false },
    { id: '2', icon: '🔄', title: 'Sync Completed', detail: 'Employee 360 Sync — 12,400 records processed', time: '15m ago', read: false },
    { id: '3', icon: '👤', title: 'Role Updated', detail: 'Admin role assigned to your account', time: '1h ago', read: false },
    { id: '4', icon: '🔗', title: 'Pipeline Created', detail: 'Order Reconciliation pipeline is now active', time: '3h ago', read: true },
    { id: '5', icon: '📋', title: 'Schema Mapped', detail: 'customers → customer_analytics mapping saved', time: '5h ago', read: true },
  ];
}
