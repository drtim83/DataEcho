import { NextResponse } from 'next/server';
import { requireUser, errorMessage } from '@/lib/supabase/server';

interface MeteringRow {
  id: string;
  pipeline_id: string;
  direction: string;
  records: number;
  bytes: number;
  compute_ms: number;
  cost_usd: number;
  timestamp: string;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [{ data: eventsData, error: eventsError }, { data: pipelinesData, error: pipelinesError }] = await Promise.all([
      supabase.from('metering_events').select('*').order('timestamp', { ascending: true }),
      supabase.from('pipelines').select('id, name, direction'),
    ]);

    if (eventsError) throw eventsError;
    if (pipelinesError) throw pipelinesError;

    const events = (eventsData || []) as MeteringRow[];
    const pipelines = pipelinesData || [];
    const pipelineById = new Map(pipelines.map((p) => [p.id, p]));

    const totalCost = events.reduce((s, e) => s + e.cost_usd, 0);
    const byDirection = (dir: string) => events.filter((e) => e.direction === dir).reduce((s, e) => s + e.cost_usd, 0);

    const summary = {
      total_cost: totalCost,
      total_records: events.reduce((s, e) => s + e.records, 0),
      total_bytes: events.reduce((s, e) => s + e.bytes, 0),
      cloud_bound_cost: byDirection('cloud_bound'),
      on_prem_bound_cost: byDirection('on_prem_bound'),
      bidirectional_cost: byDirection('bidirectional'),
    };

    const dayMap = new Map<string, { cloud: number; onPrem: number; bi: number }>();
    for (const e of events) {
      const key = dayKey(e.timestamp);
      const entry = dayMap.get(key) || { cloud: 0, onPrem: 0, bi: 0 };
      if (e.direction === 'cloud_bound') entry.cloud += e.cost_usd;
      else if (e.direction === 'on_prem_bound') entry.onPrem += e.cost_usd;
      else entry.bi += e.cost_usd;
      dayMap.set(key, entry);
    }
    const daily_costs = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e]) => ({ date, ...e }));

    const pipelineCostMap = new Map<string, { records: number; bytes: number; compute_ms: number; cost: number }>();
    for (const e of events) {
      const entry = pipelineCostMap.get(e.pipeline_id) || { records: 0, bytes: 0, compute_ms: 0, cost: 0 };
      entry.records += e.records;
      entry.bytes += e.bytes;
      entry.compute_ms += e.compute_ms;
      entry.cost += e.cost_usd;
      pipelineCostMap.set(e.pipeline_id, entry);
    }
    const pipeline_costs = Array.from(pipelineCostMap.entries())
      .map(([pipelineId, agg]) => ({
        pipeline_id: pipelineId,
        pipeline_name: pipelineById.get(pipelineId)?.name || pipelineId,
        direction: pipelineById.get(pipelineId)?.direction,
        ...agg,
      }))
      .sort((a, b) => b.cost - a.cost);

    return NextResponse.json({ summary, daily_costs, pipeline_costs });
  } catch (error) {
    console.error('GET /api/metering failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to load metering data') }, { status: 500 });
  }
}
