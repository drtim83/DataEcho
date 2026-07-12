// ============================================================
// DataEcho — TypeScript Interfaces
// ============================================================

export type ConnectorCategory = 'on_prem' | 'cloud' | 'saas';
export type ConnectorType = 'mssql' | 'oracle' | 'db2' | 'postgresql' | 'mysql' | 'supabase' | 'snowflake' | 'databricks' | 'iceberg' | 'salesforce' | 'hubspot' | 'stripe';
export type ConnectorStatus = 'connected' | 'error' | 'disconnected' | 'configuring';
export type ConnectorRole = 'source' | 'target' | 'both';

export interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  category: ConnectorCategory;
  role: ConnectorRole;
  host?: string;
  port?: number;
  database?: string;
  status: ConnectorStatus;
  tables_count: number;
  last_accessed: string;
  created_at: string;
}

export type PipelineDirection = 'cloud_bound' | 'on_prem_bound' | 'bidirectional';
export type PipelineStatus = 'active' | 'paused' | 'error' | 'draft';
export type SyncMode = 'append' | 'truncate_reload';
export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';

export interface Pipeline {
  id: string;
  name: string;
  source_connector_id: string;
  target_connector_id: string;
  source_connector?: Connector;
  target_connector?: Connector;
  direction: PipelineDirection;
  status: PipelineStatus;
  sync_mode: SyncMode;
  schedule_id?: string;
  last_sync?: string;
  records_synced: number;
  created_at: string;
}

export type CombineMode = 'union' | 'join';
export type JoinType = 'inner' | 'left';
export type MatchMode = 'all' | 'any';

export interface PipelineSource {
  id: string;
  pipeline_id: string;
  source_id: string;
  source_table: string;
  combine_mode: CombineMode;
  join_type: JoinType;
  join_column?: string;
  primary_join_column?: string;
  connector?: Connector;
  created_at: string;
}

export interface DestinationCondition {
  id: string;
  filter_column: string;
  filter_operator: FilterOperator;
  filter_value: string;
}

export interface PipelineDestination {
  id: string;
  pipeline_id: string;
  target_id: string;
  target_table: string;
  filter_column: string;
  filter_operator: FilterOperator;
  filter_value: string;
  match_mode: MatchMode;
  pipeline_destination_conditions?: DestinationCondition[];
  connector?: Connector;
  created_at: string;
}

export interface PipelineNode {
  id: string;
  pipeline_id: string;
  type: 'source' | 'target' | 'transform' | 'filter';
  label: string;
  connector_type?: ConnectorType;
  position_x: number;
  position_y: number;
  config: Record<string, unknown>;
}

export interface PipelineEdge {
  id: string;
  pipeline_id: string;
  source_node: string;
  target_node: string;
  animated: boolean;
}

export interface SchemaMapping {
  id: string;
  pipeline_id: string;
  source_col: string;
  target_col: string;
  source_type: string;
  target_type: string;
  ai_confidence: number;
  ai_warning?: string;
}

export type ScheduleType = 'cron' | 'interval' | 'event';

export interface Schedule {
  id: string;
  pipeline_id: string;
  pipeline?: Pipeline;
  name: string;
  type: ScheduleType;
  expression?: string; // cron expression
  interval_ms?: number;
  trigger_event?: string;
  timezone: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ScheduledJob {
  id: string;
  schedule_id: string;
  pipeline_id: string;
  pipeline?: Pipeline;
  status: JobStatus;
  triggered_at: string;
  started_at?: string;
  completed_at?: string;
  records_processed: number;
  records_failed: number;
  bytes_transferred: number;
  error_message?: string;
  stages?: JobStage[];
}

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface JobStage {
  id: string;
  job_id: string;
  stage_name: 'extract' | 'transform' | 'validate' | 'load';
  status: StageStatus;
  records_in: number;
  records_out: number;
  started_at?: string;
  completed_at?: string;
  progress_pct: number;
}

export interface JobMetric {
  id: string;
  job_id: string;
  timestamp: string;
  rows_per_sec: number;
  bytes_per_sec: number;
  cpu_pct: number;
  memory_mb: number;
}

export interface SyncRun {
  id: string;
  pipeline_id: string;
  pipeline?: Pipeline;
  job_id?: string;
  direction: PipelineDirection;
  status: JobStatus;
  records: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export interface Conflict {
  id: string;
  sync_run_id: string;
  pipeline_id: string;
  source_value: string;
  target_value: string;
  column_name: string;
  table_name: string;
  resolution?: 'keep_source' | 'keep_target' | 'merge' | 'skip';
  resolved_at?: string;
}

export interface MeteringEvent {
  id: string;
  pipeline_id: string;
  direction: PipelineDirection;
  records: number;
  bytes: number;
  compute_ms: number;
  cost_usd: number;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  pipeline_id?: string;
  pipeline_name?: string;
  action: string;
  actor: string;
  direction?: PipelineDirection;
  status: 'success' | 'warning' | 'error' | 'info';
  details: string;
  records_affected?: number;
  timestamp: string;
}

// Analytics aggregations
export interface DailySyncStats {
  date: string;
  total_syncs: number;
  success_count: number;
  fail_count: number;
  partial_count: number;
  total_records: number;
  avg_latency_ms: number;
}

export interface ConnectorUsage {
  connector_id: string;
  connector_name: string;
  connector_type: ConnectorType;
  total_pipelines: number;
  total_syncs: number;
  total_records: number;
  last_used: string;
}

export interface AnalyticsOverview {
  total_syncs: number;
  total_records: number;
  avg_latency_ms: number;
  success_rate: number;
  active_pipelines: number;
  total_pipelines: number;
  uptime_pct: number;
  daily_stats: DailySyncStats[];
  connector_usage: ConnectorUsage[];
  direction_split: {
    cloud_bound_records: number;
    on_prem_bound_records: number;
  };
}
