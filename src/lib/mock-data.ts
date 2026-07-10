// ============================================================
// DataEcho — Comprehensive Mock Data
// ============================================================

import type {
  Connector, Pipeline, PipelineNode, PipelineEdge, SchemaMapping,
  Schedule, ScheduledJob, JobStage, SyncRun, Conflict, MeteringEvent,
  AuditLog, DailySyncStats, ConnectorUsage, AnalyticsOverview, JobMetric
} from '@/types';

// Helper to create dates relative to now
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
function hoursAgo(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}
function minutesAgo(minutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}
function hoursFromNow(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}
function minutesFromNow(minutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

// ============================================================
// CONNECTORS
// ============================================================
export const mockConnectors: Connector[] = [
  {
    id: 'conn-1', name: 'HR Database', type: 'mssql', category: 'on_prem',
    host: '10.0.1.50', port: 1433, database: 'HumanResources',
    status: 'connected', tables_count: 47, last_accessed: minutesAgo(12), created_at: daysAgo(120),
  },
  {
    id: 'conn-2', name: 'Finance System', type: 'oracle', category: 'on_prem',
    host: '10.0.1.51', port: 1521, database: 'FINPROD',
    status: 'connected', tables_count: 83, last_accessed: minutesAgo(5), created_at: daysAgo(95),
  },
  {
    id: 'conn-3', name: 'Inventory Hub', type: 'db2', category: 'on_prem',
    host: '10.0.1.52', port: 50000, database: 'INVDB',
    status: 'connected', tables_count: 31, last_accessed: hoursAgo(2), created_at: daysAgo(80),
  },
  {
    id: 'conn-4', name: 'Analytics Warehouse', type: 'snowflake', category: 'cloud',
    host: 'acme.snowflakecomputing.com', database: 'ANALYTICS_DW',
    status: 'connected', tables_count: 156, last_accessed: minutesAgo(1), created_at: daysAgo(60),
  },
  {
    id: 'conn-5', name: 'ML Platform', type: 'databricks', category: 'cloud',
    host: 'adb-12345.azuredatabricks.net', database: 'ml_features',
    status: 'connected', tables_count: 92, last_accessed: minutesAgo(30), created_at: daysAgo(45),
  },
  {
    id: 'conn-6', name: 'Data Archive', type: 'iceberg', category: 'cloud',
    host: 's3://acme-lakehouse/', database: 'archive_catalog',
    status: 'connected', tables_count: 214, last_accessed: hoursAgo(6), created_at: daysAgo(30),
  },
];

// ============================================================
// PIPELINES
// ============================================================
export const mockPipelines: Pipeline[] = [
  {
    id: 'pipe-1', name: 'Customer 360 Sync',
    source_connector_id: 'conn-1', target_connector_id: 'conn-4',
    source_connector: mockConnectors[0], target_connector: mockConnectors[3],
    direction: 'cloud_bound', status: 'active',
    schedule_id: 'sched-1', last_sync: minutesAgo(15), records_synced: 2_847_392, created_at: daysAgo(55),
  },
  {
    id: 'pipe-2', name: 'Financial Reconciliation',
    source_connector_id: 'conn-2', target_connector_id: 'conn-5',
    source_connector: mockConnectors[1], target_connector: mockConnectors[4],
    direction: 'bidirectional', status: 'active',
    schedule_id: 'sched-2', last_sync: minutesAgo(42), records_synced: 15_623_841, created_at: daysAgo(40),
  },
  {
    id: 'pipe-3', name: 'ML Feature Backfill',
    source_connector_id: 'conn-5', target_connector_id: 'conn-3',
    source_connector: mockConnectors[4], target_connector: mockConnectors[2],
    direction: 'on_prem_bound', status: 'active',
    schedule_id: 'sched-3', last_sync: hoursAgo(3), records_synced: 892_104, created_at: daysAgo(25),
  },
  {
    id: 'pipe-4', name: 'Inventory Lakehouse',
    source_connector_id: 'conn-3', target_connector_id: 'conn-6',
    source_connector: mockConnectors[2], target_connector: mockConnectors[5],
    direction: 'cloud_bound', status: 'paused',
    last_sync: daysAgo(2), records_synced: 4_210_556, created_at: daysAgo(20),
  },
];

// ============================================================
// PIPELINE NODES & EDGES (for React Flow canvas)
// ============================================================
export const mockPipelineNodes: PipelineNode[] = [
  { id: 'node-1', pipeline_id: 'pipe-1', type: 'source', label: 'HR Database', connector_type: 'mssql', position_x: 50, position_y: 200, config: { table: 'employees', columns: ['id', 'name', 'email', 'department', 'hire_date'] } },
  { id: 'node-2', pipeline_id: 'pipe-1', type: 'transform', label: 'Clean & Dedupe', position_x: 350, position_y: 120, config: { operation: 'deduplicate', key: 'email' } },
  { id: 'node-3', pipeline_id: 'pipe-1', type: 'filter', label: 'Active Only', position_x: 350, position_y: 300, config: { condition: "status = 'active'" } },
  { id: 'node-4', pipeline_id: 'pipe-1', type: 'transform', label: 'Map Schema', position_x: 650, position_y: 200, config: { operation: 'schema_map' } },
  { id: 'node-5', pipeline_id: 'pipe-1', type: 'target', label: 'Analytics Warehouse', connector_type: 'snowflake', position_x: 950, position_y: 200, config: { table: 'dim_employees', write_mode: 'merge' } },
];

export const mockPipelineEdges: PipelineEdge[] = [
  { id: 'edge-1', pipeline_id: 'pipe-1', source_node: 'node-1', target_node: 'node-2', animated: true },
  { id: 'edge-2', pipeline_id: 'pipe-1', source_node: 'node-1', target_node: 'node-3', animated: true },
  { id: 'edge-3', pipeline_id: 'pipe-1', source_node: 'node-2', target_node: 'node-4', animated: true },
  { id: 'edge-4', pipeline_id: 'pipe-1', source_node: 'node-3', target_node: 'node-4', animated: true },
  { id: 'edge-5', pipeline_id: 'pipe-1', source_node: 'node-4', target_node: 'node-5', animated: true },
];

// ============================================================
// SCHEMA MAPPINGS
// ============================================================
export const mockSchemaMappings: SchemaMapping[] = [
  { id: 'sm-1', pipeline_id: 'pipe-1', source_col: 'employee_id', target_col: 'emp_key', source_type: 'INT', target_type: 'NUMBER(38)', ai_confidence: 0.98 },
  { id: 'sm-2', pipeline_id: 'pipe-1', source_col: 'full_name', target_col: 'employee_name', source_type: 'NVARCHAR(200)', target_type: 'VARCHAR(200)', ai_confidence: 0.95 },
  { id: 'sm-3', pipeline_id: 'pipe-1', source_col: 'email_address', target_col: 'email', source_type: 'NVARCHAR(100)', target_type: 'STRING', ai_confidence: 0.99 },
  { id: 'sm-4', pipeline_id: 'pipe-1', source_col: 'department_code', target_col: 'dept_id', source_type: 'CHAR(5)', target_type: 'VARCHAR(10)', ai_confidence: 0.87, ai_warning: 'Source CHAR(5) may have trailing spaces. Recommend TRIM() transform.' },
  { id: 'sm-5', pipeline_id: 'pipe-1', source_col: 'hire_date', target_col: 'start_date', source_type: 'DATETIME', target_type: 'TIMESTAMP_NTZ', ai_confidence: 0.92, ai_warning: 'Timezone information will be stripped. Ensure source dates are UTC.' },
  { id: 'sm-6', pipeline_id: 'pipe-3', source_col: 'prediction_score', target_col: 'ml_score', source_type: 'DOUBLE', target_type: 'DECIMAL(10,4)', ai_confidence: 0.78, ai_warning: 'DOUBLE → DECIMAL(10,4): Potential precision loss for values > 999999.9999' },
  { id: 'sm-7', pipeline_id: 'pipe-3', source_col: 'feature_vector', target_col: 'features_json', source_type: 'ARRAY<FLOAT>', target_type: 'CLOB', ai_confidence: 0.65, ai_warning: 'Array will be serialized to JSON string. Reverse mapping will require parsing.' },
];

// ============================================================
// SCHEDULES
// ============================================================
export const mockSchedules: Schedule[] = [
  { id: 'sched-1', pipeline_id: 'pipe-1', name: 'Customer Sync - Every 15min', type: 'cron', expression: '*/15 * * * *', timezone: 'UTC', enabled: true, last_run: minutesAgo(15), next_run: minutesFromNow(0), created_at: daysAgo(50), pipeline: mockPipelines[0] },
  { id: 'sched-2', pipeline_id: 'pipe-2', name: 'Finance Reconciliation - Daily', type: 'cron', expression: '0 2 * * *', timezone: 'UTC', enabled: true, last_run: hoursAgo(22), next_run: hoursFromNow(2), created_at: daysAgo(38), pipeline: mockPipelines[1] },
  { id: 'sched-3', pipeline_id: 'pipe-3', name: 'ML Backfill - Every 4 Hours', type: 'interval', interval_ms: 14400000, timezone: 'UTC', enabled: true, last_run: hoursAgo(3), next_run: hoursFromNow(1), created_at: daysAgo(20), pipeline: mockPipelines[2] },
  { id: 'sched-4', pipeline_id: 'pipe-4', name: 'Inventory Archive - On Change', type: 'event', trigger_event: 'on_data_change', timezone: 'UTC', enabled: false, last_run: daysAgo(2), created_at: daysAgo(18), pipeline: mockPipelines[3] },
  { id: 'sched-5', pipeline_id: 'pipe-2', name: 'Finance Hotfix - Weekdays 6PM', type: 'cron', expression: '0 18 * * 1,2,3,4,5', timezone: 'America/New_York', enabled: true, last_run: hoursAgo(4), next_run: hoursFromNow(20), created_at: daysAgo(10), pipeline: mockPipelines[1] },
];

// ============================================================
// SCHEDULED JOBS
// ============================================================
export const mockJobs: ScheduledJob[] = [
  {
    id: 'job-1', schedule_id: 'sched-1', pipeline_id: 'pipe-1', pipeline: mockPipelines[0],
    status: 'running', triggered_at: minutesAgo(3), started_at: minutesAgo(2),
    records_processed: 18420, records_failed: 3, bytes_transferred: 52428800,
    stages: [
      { id: 'stg-1a', job_id: 'job-1', stage_name: 'extract', status: 'completed', records_in: 24500, records_out: 24500, started_at: minutesAgo(2), completed_at: minutesAgo(1), progress_pct: 100 },
      { id: 'stg-1b', job_id: 'job-1', stage_name: 'transform', status: 'completed', records_in: 24500, records_out: 23100, started_at: minutesAgo(1), completed_at: minutesAgo(0.5), progress_pct: 100 },
      { id: 'stg-1c', job_id: 'job-1', stage_name: 'validate', status: 'running', records_in: 23100, records_out: 18420, started_at: minutesAgo(0.5), progress_pct: 72 },
      { id: 'stg-1d', job_id: 'job-1', stage_name: 'load', status: 'pending', records_in: 0, records_out: 0, progress_pct: 0 },
    ],
  },
  {
    id: 'job-2', schedule_id: 'sched-3', pipeline_id: 'pipe-3', pipeline: mockPipelines[2],
    status: 'running', triggered_at: minutesAgo(8), started_at: minutesAgo(7),
    records_processed: 45200, records_failed: 12, bytes_transferred: 134217728,
    stages: [
      { id: 'stg-2a', job_id: 'job-2', stage_name: 'extract', status: 'completed', records_in: 89000, records_out: 89000, started_at: minutesAgo(7), completed_at: minutesAgo(4), progress_pct: 100 },
      { id: 'stg-2b', job_id: 'job-2', stage_name: 'transform', status: 'running', records_in: 89000, records_out: 52300, started_at: minutesAgo(4), progress_pct: 58 },
      { id: 'stg-2c', job_id: 'job-2', stage_name: 'validate', status: 'pending', records_in: 0, records_out: 0, progress_pct: 0 },
      { id: 'stg-2d', job_id: 'job-2', stage_name: 'load', status: 'pending', records_in: 0, records_out: 0, progress_pct: 0 },
    ],
  },
  {
    id: 'job-3', schedule_id: 'sched-2', pipeline_id: 'pipe-2', pipeline: mockPipelines[1],
    status: 'completed', triggered_at: hoursAgo(22), started_at: hoursAgo(22), completed_at: hoursAgo(21),
    records_processed: 542000, records_failed: 0, bytes_transferred: 1610612736,
    stages: [
      { id: 'stg-3a', job_id: 'job-3', stage_name: 'extract', status: 'completed', records_in: 542000, records_out: 542000, started_at: hoursAgo(22), completed_at: hoursAgo(21.5), progress_pct: 100 },
      { id: 'stg-3b', job_id: 'job-3', stage_name: 'transform', status: 'completed', records_in: 542000, records_out: 540800, started_at: hoursAgo(21.5), completed_at: hoursAgo(21.2), progress_pct: 100 },
      { id: 'stg-3c', job_id: 'job-3', stage_name: 'validate', status: 'completed', records_in: 540800, records_out: 540800, started_at: hoursAgo(21.2), completed_at: hoursAgo(21.1), progress_pct: 100 },
      { id: 'stg-3d', job_id: 'job-3', stage_name: 'load', status: 'completed', records_in: 540800, records_out: 540800, started_at: hoursAgo(21.1), completed_at: hoursAgo(21), progress_pct: 100 },
    ],
  },
  {
    id: 'job-4', schedule_id: 'sched-1', pipeline_id: 'pipe-1', pipeline: mockPipelines[0],
    status: 'completed', triggered_at: minutesAgo(30), started_at: minutesAgo(29), completed_at: minutesAgo(25),
    records_processed: 23100, records_failed: 0, bytes_transferred: 65011712,
  },
  {
    id: 'job-5', schedule_id: 'sched-5', pipeline_id: 'pipe-2', pipeline: mockPipelines[1],
    status: 'failed', triggered_at: hoursAgo(4), started_at: hoursAgo(4), completed_at: hoursAgo(3.8),
    records_processed: 12400, records_failed: 892, bytes_transferred: 33554432,
    error_message: 'ORA-01653: unable to extend table FINPROD.JOURNAL_ENTRIES by 1024 in tablespace FINDATA',
  },
  {
    id: 'job-6', schedule_id: 'sched-1', pipeline_id: 'pipe-1', pipeline: mockPipelines[0],
    status: 'completed', triggered_at: minutesAgo(45), started_at: minutesAgo(44), completed_at: minutesAgo(40),
    records_processed: 22800, records_failed: 0, bytes_transferred: 62914560,
  },
  {
    id: 'job-7', schedule_id: 'sched-3', pipeline_id: 'pipe-3', pipeline: mockPipelines[2],
    status: 'completed', triggered_at: hoursAgo(7), started_at: hoursAgo(7), completed_at: hoursAgo(6),
    records_processed: 87500, records_failed: 5, bytes_transferred: 268435456,
  },
  {
    id: 'job-8', schedule_id: 'sched-1', pipeline_id: 'pipe-1', pipeline: mockPipelines[0],
    status: 'completed', triggered_at: hoursAgo(1), started_at: hoursAgo(1), completed_at: minutesAgo(55),
    records_processed: 24200, records_failed: 1, bytes_transferred: 67108864,
  },
];

// ============================================================
// JOB METRICS (live data for running jobs)
// ============================================================
export const mockJobMetrics: JobMetric[] = Array.from({ length: 20 }, (_, i) => ({
  id: `metric-${i}`,
  job_id: 'job-1',
  timestamp: minutesAgo(2 - (i * 0.1)),
  rows_per_sec: 8500 + Math.sin(i * 0.5) * 2000 + Math.random() * 500,
  bytes_per_sec: 2400000 + Math.sin(i * 0.3) * 600000 + Math.random() * 100000,
  cpu_pct: 45 + Math.sin(i * 0.4) * 15 + Math.random() * 5,
  memory_mb: 1200 + i * 20 + Math.random() * 50,
}));

// ============================================================
// SYNC RUNS
// ============================================================
export const mockSyncRuns: SyncRun[] = [
  { id: 'sr-1', pipeline_id: 'pipe-1', job_id: 'job-1', direction: 'cloud_bound', status: 'running', records: 18420, started_at: minutesAgo(3), pipeline: mockPipelines[0] },
  { id: 'sr-2', pipeline_id: 'pipe-3', job_id: 'job-2', direction: 'on_prem_bound', status: 'running', records: 45200, started_at: minutesAgo(8), pipeline: mockPipelines[2] },
  { id: 'sr-3', pipeline_id: 'pipe-2', job_id: 'job-3', direction: 'bidirectional', status: 'completed', records: 542000, started_at: hoursAgo(22), completed_at: hoursAgo(21), pipeline: mockPipelines[1] },
  { id: 'sr-4', pipeline_id: 'pipe-1', job_id: 'job-4', direction: 'cloud_bound', status: 'completed', records: 23100, started_at: minutesAgo(30), completed_at: minutesAgo(25), pipeline: mockPipelines[0] },
  { id: 'sr-5', pipeline_id: 'pipe-2', job_id: 'job-5', direction: 'bidirectional', status: 'failed', records: 12400, started_at: hoursAgo(4), completed_at: hoursAgo(3.8), error: 'Tablespace FINDATA full', pipeline: mockPipelines[1] },
];

// ============================================================
// CONFLICTS
// ============================================================
export const mockConflicts: Conflict[] = [
  { id: 'conf-1', sync_run_id: 'sr-1', pipeline_id: 'pipe-1', source_value: 'John Smith', target_value: 'Jonathan Smith', column_name: 'full_name', table_name: 'employees' },
  { id: 'conf-2', sync_run_id: 'sr-1', pipeline_id: 'pipe-1', source_value: '2024-01-15', target_value: '2024-01-16', column_name: 'hire_date', table_name: 'employees' },
  { id: 'conf-3', sync_run_id: 'sr-2', pipeline_id: 'pipe-3', source_value: '0.89234521', target_value: '0.8923', column_name: 'ml_score', table_name: 'predictions' },
  { id: 'conf-4', sync_run_id: 'sr-3', pipeline_id: 'pipe-2', source_value: '45230.99', target_value: '45231.00', column_name: 'balance', table_name: 'accounts', resolution: 'keep_source', resolved_at: hoursAgo(20) },
  { id: 'conf-5', sync_run_id: 'sr-3', pipeline_id: 'pipe-2', source_value: 'ACTIVE', target_value: 'active', column_name: 'status', table_name: 'accounts', resolution: 'merge', resolved_at: hoursAgo(20) },
];

// ============================================================
// METERING EVENTS (30 days)
// ============================================================
export const mockMeteringEvents: MeteringEvent[] = Array.from({ length: 30 }, (_, i) => ([
  {
    id: `meter-cb-${i}`, pipeline_id: 'pipe-1', direction: 'cloud_bound' as const,
    records: 20000 + Math.floor(Math.random() * 10000),
    bytes: 50000000 + Math.floor(Math.random() * 30000000),
    compute_ms: 180000 + Math.floor(Math.random() * 60000),
    cost_usd: 2.4 + Math.random() * 1.2,
    timestamp: daysAgo(29 - i),
  },
  {
    id: `meter-op-${i}`, pipeline_id: 'pipe-3', direction: 'on_prem_bound' as const,
    records: 80000 + Math.floor(Math.random() * 20000),
    bytes: 200000000 + Math.floor(Math.random() * 100000000),
    compute_ms: 600000 + Math.floor(Math.random() * 200000),
    cost_usd: 8.5 + Math.random() * 3.0,
    timestamp: daysAgo(29 - i),
  },
  {
    id: `meter-bi-${i}`, pipeline_id: 'pipe-2', direction: 'bidirectional' as const,
    records: 500000 + Math.floor(Math.random() * 100000),
    bytes: 1500000000 + Math.floor(Math.random() * 500000000),
    compute_ms: 3600000 + Math.floor(Math.random() * 600000),
    cost_usd: 24.0 + Math.random() * 8.0,
    timestamp: daysAgo(29 - i),
  },
])).flat();

// ============================================================
// AUDIT LOGS
// ============================================================
export const mockAuditLogs: AuditLog[] = [
  { id: 'log-1', pipeline_id: 'pipe-1', pipeline_name: 'Customer 360 Sync', action: 'sync_started', actor: 'scheduler', direction: 'cloud_bound', status: 'info', details: 'Scheduled sync triggered (cron: */15 * * * *)', records_affected: 0, timestamp: minutesAgo(3) },
  { id: 'log-2', pipeline_id: 'pipe-1', pipeline_name: 'Customer 360 Sync', action: 'extract_complete', actor: 'system', direction: 'cloud_bound', status: 'success', details: 'Extracted 24,500 rows from HR Database', records_affected: 24500, timestamp: minutesAgo(1) },
  { id: 'log-3', pipeline_id: 'pipe-3', pipeline_name: 'ML Feature Backfill', action: 'sync_started', actor: 'scheduler', direction: 'on_prem_bound', status: 'info', details: 'Interval sync triggered (every 4 hours)', records_affected: 0, timestamp: minutesAgo(8) },
  { id: 'log-4', pipeline_id: 'pipe-2', pipeline_name: 'Financial Reconciliation', action: 'sync_failed', actor: 'system', direction: 'bidirectional', status: 'error', details: 'ORA-01653: unable to extend table FINPROD.JOURNAL_ENTRIES', records_affected: 12400, timestamp: hoursAgo(4) },
  { id: 'log-5', pipeline_id: 'pipe-2', pipeline_name: 'Financial Reconciliation', action: 'conflict_detected', actor: 'system', direction: 'bidirectional', status: 'warning', details: '2 conflicts detected in accounts table', records_affected: 2, timestamp: hoursAgo(21) },
  { id: 'log-6', pipeline_id: 'pipe-2', pipeline_name: 'Financial Reconciliation', action: 'conflict_resolved', actor: 'admin@dataecho.app', direction: 'bidirectional', status: 'success', details: 'Resolved 2 conflicts: keep_source, merge', records_affected: 2, timestamp: hoursAgo(20) },
  { id: 'log-7', pipeline_id: 'pipe-2', pipeline_name: 'Financial Reconciliation', action: 'sync_completed', actor: 'system', direction: 'bidirectional', status: 'success', details: 'Synced 542,000 records in 1h 0m', records_affected: 542000, timestamp: hoursAgo(21) },
  { id: 'log-8', pipeline_id: 'pipe-1', pipeline_name: 'Customer 360 Sync', action: 'sync_completed', actor: 'system', direction: 'cloud_bound', status: 'success', details: 'Synced 23,100 records in 4m 32s', records_affected: 23100, timestamp: minutesAgo(25) },
  { id: 'log-9', pipeline_id: 'pipe-4', pipeline_name: 'Inventory Lakehouse', action: 'pipeline_paused', actor: 'admin@dataecho.app', status: 'warning', details: 'Pipeline paused by admin for maintenance', timestamp: daysAgo(2) },
  { id: 'log-10', pipeline_name: 'System', action: 'connector_added', actor: 'admin@dataecho.app', status: 'info', details: 'New connector added: Data Archive (Apache Iceberg)', timestamp: daysAgo(30) },
  { id: 'log-11', pipeline_id: 'pipe-1', pipeline_name: 'Customer 360 Sync', action: 'schema_mapped', actor: 'ai_agent', direction: 'cloud_bound', status: 'success', details: 'AI mapped 5 columns with avg confidence 94.2%', records_affected: 5, timestamp: daysAgo(50) },
  { id: 'log-12', pipeline_id: 'pipe-3', pipeline_name: 'ML Feature Backfill', action: 'sync_completed', actor: 'system', direction: 'on_prem_bound', status: 'success', details: 'Synced 87,500 records in 58m', records_affected: 87500, timestamp: hoursAgo(6) },
  { id: 'log-13', pipeline_id: 'pipe-1', pipeline_name: 'Customer 360 Sync', action: 'sync_completed', actor: 'system', direction: 'cloud_bound', status: 'success', details: 'Synced 24,200 records in 4m 18s', records_affected: 24200, timestamp: minutesAgo(55) },
  { id: 'log-14', pipeline_name: 'System', action: 'user_login', actor: 'admin@dataecho.app', status: 'info', details: 'User logged in from 192.168.1.100', timestamp: hoursAgo(8) },
  { id: 'log-15', pipeline_id: 'pipe-3', pipeline_name: 'ML Feature Backfill', action: 'conflict_detected', actor: 'system', direction: 'on_prem_bound', status: 'warning', details: 'Precision loss detected in ml_score column', records_affected: 12, timestamp: minutesAgo(6) },
];

// ============================================================
// DAILY SYNC STATS (30 days for analytics)
// ============================================================
export const mockDailyStats: DailySyncStats[] = Array.from({ length: 30 }, (_, i) => ({
  date: daysAgo(29 - i).split('T')[0],
  total_syncs: 85 + Math.floor(Math.random() * 30),
  success_count: 78 + Math.floor(Math.random() * 25),
  fail_count: Math.floor(Math.random() * 5),
  partial_count: Math.floor(Math.random() * 3),
  total_records: 600000 + Math.floor(Math.random() * 200000),
  avg_latency_ms: 2800 + Math.floor(Math.random() * 1500),
}));

// ============================================================
// CONNECTOR USAGE (analytics)
// ============================================================
export const mockConnectorUsage: ConnectorUsage[] = mockConnectors.map(c => ({
  connector_id: c.id,
  connector_name: c.name,
  connector_type: c.type,
  total_pipelines: c.category === 'cloud' ? 2 : 1,
  total_syncs: 200 + Math.floor(Math.random() * 800),
  total_records: 1000000 + Math.floor(Math.random() * 5000000),
  last_used: c.last_accessed,
}));

// ============================================================
// ANALYTICS OVERVIEW
// ============================================================
export const mockAnalyticsOverview: AnalyticsOverview = {
  total_syncs: 2847,
  total_records: 23_573_337,
  avg_latency_ms: 3240,
  success_rate: 97.2,
  active_pipelines: 3,
  total_pipelines: 4,
  uptime_pct: 99.94,
  daily_stats: mockDailyStats,
  connector_usage: mockConnectorUsage,
  direction_split: {
    cloud_bound_records: 15_847_392,
    on_prem_bound_records: 7_725_945,
  },
};

// ============================================================
// ACTIVITY FEED (for dashboard)
// ============================================================
export interface ActivityEvent {
  id: string;
  icon: string;
  message: string;
  timestamp: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export const mockActivityFeed: ActivityEvent[] = [
  { id: 'act-1', icon: '🔄', message: 'Customer 360 Sync — extracting 24,500 rows', timestamp: minutesAgo(3), type: 'info' },
  { id: 'act-2', icon: '✅', message: 'Customer 360 Sync — completed (23,100 records)', timestamp: minutesAgo(25), type: 'success' },
  { id: 'act-3', icon: '🔄', message: 'ML Feature Backfill — transforming batch 3/5', timestamp: minutesAgo(5), type: 'info' },
  { id: 'act-4', icon: '❌', message: 'Financial Reconciliation — tablespace FINDATA full', timestamp: hoursAgo(4), type: 'error' },
  { id: 'act-5', icon: '⚠️', message: '2 conflicts detected in accounts table', timestamp: hoursAgo(21), type: 'warning' },
  { id: 'act-6', icon: '✅', message: 'Financial Reconciliation — synced 542K records', timestamp: hoursAgo(21), type: 'success' },
  { id: 'act-7', icon: '🧠', message: 'AI mapped 5 columns (94.2% avg confidence)', timestamp: daysAgo(1), type: 'info' },
  { id: 'act-8', icon: '✅', message: 'ML Feature Backfill — completed (87,500 records)', timestamp: hoursAgo(6), type: 'success' },
];
