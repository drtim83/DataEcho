// ============================================================
// DataEcho — Utility Functions
// ============================================================

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_099_511_627_776) return (bytes / 1_099_511_627_776).toFixed(2) + ' TB';
  if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(2) + ' GB';
  if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' B';
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return ms + 'ms';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return seconds + 's';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getDirectionLabel(direction: string): string {
  switch (direction) {
    case 'cloud_bound': return '↑ Cloud';
    case 'on_prem_bound': return '↓ On-Prem';
    case 'bidirectional': return '↕ Bidirectional';
    default: return direction;
  }
}

export function getDirectionColor(direction: string): string {
  switch (direction) {
    case 'cloud_bound': return 'teal';
    case 'on_prem_bound': return 'amber';
    case 'bidirectional': return 'purple';
    default: return 'blue';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'connected': case 'completed': case 'active': case 'success': return 'teal';
    case 'running': case 'syncing': return 'blue';
    case 'error': case 'failed': return 'coral';
    case 'warning': case 'pending': return 'amber';
    case 'disconnected': case 'paused': case 'draft': case 'cancelled': return 'text-muted';
    default: return 'blue';
  }
}

export function getConnectorIcon(type: string): string {
  switch (type) {
    case 'mssql': return '🗄️';
    case 'oracle': return '🔴';
    case 'db2': return '🔵';
    case 'postgresql': return '🐘';
    case 'mysql': return '🐬';
    case 'supabase': return '⚡';
    case 's3': return '🪣';
    case 'azure_blob': return '🔷';
    case 'gcs': return '🌩️';
    case 'snowflake': return '❄️';
    case 'databricks': return '🔶';
    case 'iceberg': return '🧊';
    case 'salesforce': return '☁️';
    case 'hubspot': return '🟠';
    case 'stripe': return '💳';
    default: return '🔌';
  }
}

export function getConnectorLabel(type: string): string {
  switch (type) {
    case 'mssql': return 'MS SQL Server';
    case 'oracle': return 'Oracle DB';
    case 'db2': return 'IBM DB2';
    case 'postgresql': return 'PostgreSQL';
    case 'mysql': return 'MySQL';
    case 'supabase': return 'Supabase';
    case 's3': return 'Amazon S3';
    case 'azure_blob': return 'Azure Blob Storage';
    case 'gcs': return 'Google Cloud Storage';
    case 'snowflake': return 'Snowflake';
    case 'databricks': return 'Databricks';
    case 'iceberg': return 'Apache Iceberg';
    case 'salesforce': return 'Salesforce';
    case 'hubspot': return 'HubSpot';
    case 'stripe': return 'Stripe';
    default: return type;
  }
}

export function parseCronExpression(expression: string): string {
  const parts = expression.split(' ');
  if (parts.length !== 5) return expression;
  const [min, hour, dom, month, dow] = parts;
  if (min === '*' && hour === '*') return 'Every minute';
  if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`;
  if (hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;
  if (dom === '*' && month === '*' && dow === '*') return `Daily at ${hour}:${min.padStart(2, '0')} UTC`;
  if (dom === '*' && month === '*' && dow !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNames = dow.split(',').map(d => days[parseInt(d)] || d).join(', ');
    return `${dayNames} at ${hour}:${min.padStart(2, '0')} UTC`;
  }
  return expression;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
