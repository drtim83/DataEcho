import { isIP } from 'net';
import type { ConnectorType } from '@/types';

// tedious (the mssql driver) picks the TLS SNI servername from two different
// code paths that disagree on IP hosts: one correctly falls back to an empty
// string for an IP literal, the other doesn't and hands Node's tls module the
// raw IP, which it rejects ("Setting the TLS ServerName to an IP address is
// not permitted"). Forcing an explicit non-IP serverName short-circuits both
// paths; the actual value is inert since trustServerCertificate skips
// hostname verification.
export function mssqlOptions(host: string): { encrypt: boolean; trustServerCertificate: boolean; serverName?: string } {
  return {
    encrypt: true,
    trustServerCertificate: true,
    ...(isIP(host) ? { serverName: 'sqlserver' } : {}),
  };
}

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
    options: mssqlOptions(input.host),
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

// input.database is treated as the Oracle service name (Easy Connect syntax:
// host:port/serviceName), since Oracle has no separate "database" concept —
// a service name identifies a pluggable database within an instance.
async function testOracle(input: DbTestInput): Promise<DbTestResult> {
  const oracledb = await import('oracledb');
  const connection = await withTimeout(
    oracledb.getConnection({
      user: input.username,
      password: input.password,
      connectString: `${input.host}:${input.port || 1521}/${input.database}`,
    }),
    TIMEOUT_MS
  );
  try {
    return { success: true, supported: true, message: 'Connection successful.', serverVersion: connection.oracleServerVersionString ?? undefined };
  } finally {
    await connection.close().catch(() => {});
  }
}

// Shared by db-test.ts/db-schema.ts/db-sync.ts. input.host doubles as an
// optional S3-compatible endpoint override (e.g. LocalStack); left blank it
// connects to real AWS S3. Region isn't exposed in the connector form yet —
// hardcoded to us-east-1 (see IMPLEMENTATION_PLAN.md Part 3 for the
// follow-up to make this configurable).
export async function createS3Client(input: DbTestInput) {
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({
    region: 'us-east-1',
    endpoint: input.host || undefined,
    forcePathStyle: !!input.host,
    credentials: { accessKeyId: input.username || '', secretAccessKey: input.password || '' },
  });
}

// A "table" for an S3 connector is a single object key holding either CSV or
// JSON (array of flat objects), chosen by file extension — not a whole
// prefix/multi-file scan. The CSV path is a naive split (no quoted-comma
// escaping); fine for the straightforward exports this targets, not a
// general-purpose CSV engine.
export function parseS3Rows(key: string, body: string): Record<string, unknown>[] {
  if (key.toLowerCase().endsWith('.csv')) {
    const lines = body.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(',');
      const row: Record<string, unknown> = {};
      headers.forEach((h, i) => { row[h] = values[i]?.trim() ?? null; });
      return row;
    });
  }
  if (!body.trim()) return [];
  const parsed = JSON.parse(body);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export function serializeS3Rows(key: string, rows: Record<string, unknown>[]): string {
  if (key.toLowerCase().endsWith('.csv')) {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => String(row[h] ?? '')).join(','))];
    return lines.join('\n');
  }
  return JSON.stringify(rows, null, 2);
}

// Shared by db-test.ts/db-schema.ts/db-sync.ts. Account name/key ("shared
// key" auth) rather than a connection string or SAS token, to keep the same
// host/database/username/password shape every other connector uses.
// input.host doubles as an optional endpoint override (e.g. Azurite);
// blank derives the real Azure endpoint from the account name.
export async function createAzureContainerClient(input: DbTestInput) {
  const { BlobServiceClient, StorageSharedKeyCredential } = await import('@azure/storage-blob');
  const accountName = input.username || '';
  const credential = new StorageSharedKeyCredential(accountName, input.password || '');
  const endpoint = input.host || `https://${accountName}.blob.core.windows.net`;
  const serviceClient = new BlobServiceClient(endpoint, credential);
  return serviceClient.getContainerClient(input.database);
}

// Azure's SDK doesn't ship an AWS-SDK-v3-style transformToString() helper —
// blob downloads return a raw Node readable stream to consume manually.
export async function streamToString(readable: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function testAzure(input: DbTestInput): Promise<DbTestResult> {
  const containerClient = await createAzureContainerClient(input);
  await withTimeout(containerClient.getProperties(), TIMEOUT_MS);
  return { success: true, supported: true, message: 'Connection successful.' };
}

// Shared by db-test.ts/db-schema.ts/db-sync.ts. GCS auth is normally a full
// service-account JSON key rather than a simple key pair; the "password"
// field holds that key minified to one line (valid JSON either way — the
// private key's newlines are already \n-escaped inside the JSON string, not
// literal), which fits the existing single-line password input without a
// form redesign. "username" optionally holds the project ID, otherwise it's
// read from the key itself. input.host doubles as an optional API endpoint
// override (e.g. fake-gcs-server); blank connects to real GCS.
export async function createGcsBucket(input: DbTestInput) {
  const { Storage } = await import('@google-cloud/storage');
  let credentials: Record<string, unknown> | undefined;
  if (input.password) {
    try {
      credentials = JSON.parse(input.password);
    } catch {
      // Not valid JSON — likely pointed at an emulator that doesn't need
      // real credentials; proceed without them.
    }
  }
  const projectId = input.username || (credentials?.project_id as string | undefined) || 'local-project';
  const storage = new Storage({
    projectId,
    credentials,
    apiEndpoint: input.host || undefined,
  });
  return storage.bucket(input.database);
}

async function testGcs(input: DbTestInput): Promise<DbTestResult> {
  const bucket = await createGcsBucket(input);
  const [exists] = await withTimeout(bucket.exists(), TIMEOUT_MS);
  if (!exists) throw new Error(`Bucket "${input.database}" does not exist or is not accessible.`);
  return { success: true, supported: true, message: 'Connection successful.' };
}

async function testS3(input: DbTestInput): Promise<DbTestResult> {
  const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
  const client = await createS3Client(input);
  await withTimeout(client.send(new HeadBucketCommand({ Bucket: input.database })), TIMEOUT_MS);
  return { success: true, supported: true, message: 'Connection successful.' };
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
      case 'oracle':
        result = await testOracle(input);
        break;
      case 's3':
        result = await testS3(input);
        break;
      case 'azure_blob':
        result = await testAzure(input);
        break;
      case 'gcs':
        result = await testGcs(input);
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
