'use client';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'badge-teal' },
  connected: { label: 'Connected', className: 'badge-teal' },
  completed: { label: 'Completed', className: 'badge-teal' },
  success: { label: 'Success', className: 'badge-teal' },
  running: { label: 'Running', className: 'badge-blue' },
  syncing: { label: 'Syncing', className: 'badge-blue' },
  pending: { label: 'Pending', className: 'badge-amber' },
  warning: { label: 'Warning', className: 'badge-amber' },
  configuring: { label: 'Configuring', className: 'badge-amber' },
  error: { label: 'Error', className: 'badge-coral' },
  failed: { label: 'Failed', className: 'badge-coral' },
  paused: { label: 'Paused', className: 'badge-purple' },
  draft: { label: 'Draft', className: 'badge-purple' },
  cancelled: { label: 'Cancelled', className: 'badge-purple' },
  disconnected: { label: 'Disconnected', className: 'badge-coral' },
  info: { label: 'Info', className: 'badge-blue' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'badge-blue' };
  return (
    <span className={`badge ${config.className} ${size === 'sm' ? 'text-[11px] px-2 py-0.5' : ''}`}>
      <span className={`status-dot ${status}`}></span>
      {config.label}
    </span>
  );
}
