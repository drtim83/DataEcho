import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from './crypto';
import type { DbTestInput } from './db-test';
import type { ConnectorType } from '@/types';

export async function getConnectorConnectionInput(supabase: SupabaseClient, connectorId: string): Promise<DbTestInput & { name: string }> {
  const { data: row, error } = await supabase
    .from('connectors')
    .select('name, type, config')
    .eq('id', connectorId)
    .single();

  if (error || !row) {
    throw new Error(`Connector ${connectorId} not found`);
  }

  const config = row.config as { host?: string; port?: number; database?: string; username?: string; password?: string };

  return {
    name: row.name,
    type: row.type as ConnectorType,
    host: config?.host || '',
    port: config?.port,
    database: config?.database || '',
    username: config?.username,
    password: config?.password ? decrypt(config.password) : undefined,
  };
}
