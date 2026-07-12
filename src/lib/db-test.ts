import type { ConnectorType } from '@/types';

export interface DbTestInput {
  type: ConnectorType;
  host: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
}

export interface DbTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  serverVersion?: string;
  supported: boolean;
}

const TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Connection timed out after ${ms}ms`)), ms)),
  ]);
}

async function testMssql(input: DbTestInput): Promise<DbTestResult> {
  const sql = (await import('mssql')).default;
  const pool = new sql.ConnectionPool({
    server: input.host,
    port: input.port || 1433,
    database: input.database,
    user: input.username,
    password: input.password,
    connectionTimeout: TIMEOUT_MS,
    options: { encrypt: true, trustServerCertificate: true },
  });
  try {
    await withTimeout(pool.connect(), TIMEOUT_MS);
    const result = await pool.request().query('SELECT @@VERSION as version');
    return { success: true, supported: true, message: 'Connection successful.', serverVersion: result.recordset[0]?.version };
  } finally {
    await pool.close().catch(() => {});
  }
}

async function testPostgres(input: DbTestInput): Promise<DbTestResult> {
  const { Client } = await import('pg');
  const client = new Client({
    host: input.host,
    port: input.port || 5432,
    database: input.database,
    user: input.username,
    password: input.password,
    connectionTimeoutMillis: TIMEOUT_MS,
    // Supabase's hosted Postgres always requires SSL; plain on-prem Postgres usually doesn't.
    ssl: input.type === 'supabase' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await withTimeout(client.connect(), TIMEOUT_MS);
    const result = await client.query('SELECT version()');
    return { success: true, supported: true, message: 'Connection successful.', serverVersion: result.rows[0]?.version };
  } finally {
    await client.end().catch(() => {});
  }
}

async function testMysql(input: DbTestInput): Promise<DbTestResult> {
  const mysql = await import('mysql2/promise');
  const connection = await withTimeout(
    mysql.createConnection({
      host: input.host,
      port: input.port || 3306,
      database: input.database,
      user: input.username,
      password: input.password,
      connectTimeout: TIMEOUT_MS,
    }),
    TIMEOUT_MS
  );
  try {
    const [rows] = await connection.query('SELECT VERSION() as version');
    const version = Array.isArray(rows) ? (rows[0] as { version?: string })?.version : undefined;
    return { success: true, supported: true, message: 'Connection successful.', serverVersion: version };
  } finally {
    await connection.end().catch(() => {});
  }
}

const UNSUPPORTED_MESSAGE: Partial<Record<ConnectorType, string>> = {
  oracle: 'Live testing for Oracle DB is not implemented yet.',
  db2: 'Live testing for IBM DB2 is not implemented yet.',
  snowflake: 'Live testing for Snowflake is not implemented yet.',
  databricks: 'Live testing for Databricks is not implemented yet.',
  iceberg: 'Live testing for Apache Iceberg is not implemented yet.',
  salesforce: 'Live testing for Salesforce is not implemented yet.',
  hubspot: 'Live testing for HubSpot is not implemented yet.',
  stripe: 'Live testing for Stripe is not implemented yet.',
};

export async function testConnection(input: DbTestInput): Promise<DbTestResult> {
  const started = Date.now();
  try {
    let result: DbTestResult;
    switch (input.type) {
      case 'mssql':
        result = await testMssql(input);
        break;
      case 'postgresql':
      case 'supabase':
        result = await testPostgres(input);
        break;
      case 'mysql':
        result = await testMysql(input);
        break;
      default:
        return {
          success: false,
          supported: false,
          message: UNSUPPORTED_MESSAGE[input.type] || `Live testing for ${input.type} is not implemented yet.`,
        };
    }
    return { ...result, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      success: false,
      supported: true,
      message: err instanceof Error ? err.message : 'Connection failed.',
      latencyMs: Date.now() - started,
    };
  }
}
