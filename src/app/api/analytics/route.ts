import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

interface SyncRunRow {
  id: string;
  pipeline_id: string;
  direction: string;
  status: string;
  records: number;
  started_at: string;
  completed_at: string | null;
}

interface PipelineRow {
  id: string;
  name: string;
  source_id: string;
  target_id: string;
  direction: string;
  status: string;
}

interface ConnectorRow {
  id: string;
  name: string;
  type: string;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [{ data: runsData, error: runsError }, { data: pipelinesData, error: pipelinesError }, { data: connectorsData, error: connectorsError }] = await Promise.all([
      supabase.from('sync_runs').select('id, pipeline_id, direction, status, records, started_at, completed_at').order('started_at', { ascending: true }),
      supabase.from('pipelines').select('id, name, source_id, target_id, direction, status'),
      supabase.from('connectors').select('id, name, type'),
    ]);

    if (runsError) throw runsError;
    if (pipelinesError) throw pipelinesError;
    if (connectorsError) throw connectorsError;

    const runs = (runsData || []) as SyncRunRow[];
    const pipelines = (pipelinesData || []) as PipelineRow[];
    const connectors = (connectorsData || []) as ConnectorRow[];

    const completedRuns = runs.filter((r) => r.status === 'completed');
    const latencies = completedRuns
      .filter((r) => r.completed_at)
      .map((r) => new Date(r.completed_at!).getTime() - new Date(r.started_at).getTime());

    const overview = {
      total_syncs: runs.length,
      total_records: runs.reduce((sum, r) => sum + (r.records || 0), 0),
      avg_latency_ms: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      success_rate: runs.length > 0 ? Math.round((completedRuns.length / runs.length) * 1000) / 10 : null,
      active_pipelines: pipelines.filter((p) => p.status === 'active').length,
      total_pipelines: pipelines.length,
    };

    // Daily stats
    const dayMap = new Map<string, { total_syncs: number; success_count: number; fail_count: number; total_records: number; latencies: number[] }>();
    for (const r of runs) {
      const key = dayKey(r.started_at);
      const entry = dayMap.get(key) || { total_syncs: 0, success_count: 0, fail_count: 0, total_records: 0, latencies: [] };
      entry.total_syncs += 1;
      if (r.status === 'completed') entry.success_count += 1;
      if (r.status === 'failed') entry.fail_count += 1;
      entry.total_records += r.records || 0;
      if (r.completed_at) entry.latencies.push(new Date(r.completed_at).getTime() - new Date(r.started_at).getTime());
      dayMap.set(key, entry);
    }
    const daily_stats = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e]) => ({
        date,
        total_syncs: e.total_syncs,
        success_count: e.success_count,
        fail_count: e.fail_count,
        total_records: e.total_records,
        avg_latency_ms: e.latencies.length > 0 ? Math.round(e.latencies.reduce((a, b) => a + b, 0) / e.latencies.length) : 0,
      }));

    // Connector usage: sum records for runs whose pipeline uses this connector as source or target
    const connector_usage = connectors.map((c) => {
      const relatedPipelineIds = new Set(pipelines.filter((p) => p.source_id === c.id || p.target_id === c.id).map((p) => p.id));
      const relatedRuns = runs.filter((r) => relatedPipelineIds.has(r.pipeline_id));
      return {
        connector_id: c.id,
        connector_name: c.name,
        connector_type: c.type,
        total_pipelines: relatedPipelineIds.size,
        total_syncs: relatedRuns.length,
        total_records: relatedRuns.reduce((sum, r) => sum + (r.records || 0), 0),
      };
    }).filter((c) => c.total_syncs > 0).sort((a, b) => b.total_records - a.total_records);

    // Direction split
    const direction_split = {
      cloud_bound_records: runs.filter((r) => r.direction === 'cloud_bound').reduce((sum, r) => sum + (r.records || 0), 0),
      on_prem_bound_records: runs.filter((r) => r.direction === 'on_prem_bound').reduce((sum, r) => sum + (r.records || 0), 0),
      bidirectional_records: runs.filter((r) => r.direction === 'bidirectional').reduce((sum, r) => sum + (r.records || 0), 0),
    };

    // Pipeline leaderboard
    const pipeline_leaderboard = pipelines.map((p) => {
      const pRuns = runs.filter((r) => r.pipeline_id === p.id);
      const pCompleted = pRuns.filter((r) => r.status === 'completed');
      const pLatencies = pCompleted.filter((r) => r.completed_at).map((r) => new Date(r.completed_at!).getTime() - new Date(r.started_at).getTime());
      return {
        pipeline_id: p.id,
        name: p.name,
        total_syncs: pRuns.length,
        records: pRuns.reduce((sum, r) => sum + (r.records || 0), 0),
        avg_latency_ms: pLatencies.length > 0 ? Math.round(pLatencies.reduce((a, b) => a + b, 0) / pLatencies.length) : 0,
        success_rate: pRuns.length > 0 ? Math.round((pCompleted.length / pRuns.length) * 1000) / 10 : 0,
      };
    }).filter((p) => p.total_syncs > 0).sort((a, b) => b.records - a.records);

    // Hourly throughput for the last 24 hours (for the dashboard's Throughput chart)
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const recentRuns = runs.filter((r) => new Date(r.started_at).getTime() >= dayAgo);
    const hourly_throughput = Array.from({ length: 24 }, (_, i) => {
      const bucketStart = dayAgo + i * 60 * 60 * 1000;
      const bucketEnd = bucketStart + 60 * 60 * 1000;
      const bucketRuns = recentRuns.filter((r) => {
        const t = new Date(r.started_at).getTime();
        return t >= bucketStart && t < bucketEnd;
      });
      return {
        hour: new Date(bucketStart).toISOString(),
        cloud: bucketRuns.filter((r) => r.direction === 'cloud_bound').reduce((s, r) => s + (r.records || 0), 0),
        onPrem: bucketRuns.filter((r) => r.direction === 'on_prem_bound').reduce((s, r) => s + (r.records || 0), 0),
        bidirectional: bucketRuns.filter((r) => r.direction === 'bidirectional').reduce((s, r) => s + (r.records || 0), 0),
      };
    });

    return NextResponse.json({ overview, daily_stats, connector_usage, direction_split, pipeline_leaderboard, hourly_throughput });
  } catch (error) {
    console.error('GET /api/analytics failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load analytics') }, { status: 500 });
  }
}
