import type { Firestore } from 'firebase-admin/firestore';
import { decrypt } from './crypto';
import type { DbTestInput } from './db-test';
import type { ConnectorType } from '@/types';

export async function getConnectorConnectionInput(
  db: Firestore,
  connectorId: string
): Promise<DbTestInput & { name: string }> {
  const snap = await db.collection('connectors').doc(connectorId).get();

  if (!snap.exists) {
    throw new Error(`Connector ${connectorId} not found`);
  }

  const row = snap.data() as {
    name: string;
    type: ConnectorType;
    config?: {
      host?: string;
      port?: number;
      database?: string;
      username?: string;
      password?: string;
    };
  };

  const config = row.config || {};

  return {
    name: row.name,
    type: row.type,
    host: config.host || '',
    port: config.port,
    database: config.database || '',
    username: config.username,
    password: config.password ? decrypt(config.password) : undefined,
  };
}
