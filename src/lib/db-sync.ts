import { mssqlOptions, createS3Client, parseS3Rows, serializeS3Rows, createAzureContainerClient, streamToString, createGcsBucket, type DbTestInput } from './db-test';
import type { ColumnMapping } from './schema-mapper';

const TIMEOUT_MS = 15000;
export const MAX_SYNC_ROWS = 1000;

// Same identifier-allowlist approach as the on-prem agent (agent/src/server.ts)
// to prevent SQL injection via table/column names, which can't be parameterized.
function sanitizeIdentifier(identifier: string): string[] {
  const parts = identifier.split('.');
  if (parts.length > 2 || parts.some((p) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(p))) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return parts;
}

async function extractMssql(input: DbTestInput, table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const sql = (await import('mssql')).default;
  const safeTable = sanitizeIdentifier(table).map((p) => `[${p}]`).join('.');
  const colList = columns.map((c) => `[${sanitizeIdentifier(c)[0]}]`).join(', ');
  const pool = new sql.ConnectionPool({
    server: input.host, port: input.port || 1433, database: input.database,
    user: input.username, password: input.password, connectionTimeout: TIMEOUT_MS,
    options: mssqlOptions(input.host),
  });
  try {
    await pool.connect();
    const result = await pool.request().query(`SELECT TOP (${MAX_SYNC_ROWS}) ${colList} FROM ${safeTable}`);
    return result.recordset;
  } finally {
    await pool.close().catch(() => {});
  }
}

async function extractPostgres(input: DbTestInput, table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const { Client } = await import('pg');
  const safeTable = sanitizeIdentifier(table).map((p) => `"${p}"`).join('.');
  const colList = columns.map((c) => `"${sanitizeIdentifier(c)[0]}"`).join(', ');
  const client = new Client({
    host: input.host, port: input.port || 5432, database: input.database,
    user: input.username, password: input.password, connectionTimeoutMillis: TIMEOUT_MS,
    ssl: input.type === 'supabase' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await client.connect();
    const result = await client.query(`SELECT ${colList} FROM ${safeTable} LIMIT ${MAX_SYNC_ROWS}`);
    return result.rows;
  } finally {
    await client.end().catch(() => {});
  }
}

async function extractMysql(input: DbTestInput, table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const mysql = await import('mysql2/promise');
  const safeTable = sanitizeIdentifier(table).map((p) => `\`${p}\``).join('.');
  const colList = columns.map((c) => `\`${sanitizeIdentifier(c)[0]}\``).join(', ');
  const connection = await mysql.createConnection({
    host: input.host, port: input.port || 3306, database: input.database,
    user: input.username, password: input.password, connectTimeout: TIMEOUT_MS,
  });
  try {
    const [rows] = await connection.query(`SELECT ${colList} FROM ${safeTable} LIMIT ${MAX_SYNC_ROWS}`);
    return rows as Record<string, unknown>[];
  } finally {
    await connection.end().catch(() => {});
  }
}

// Oracle stores/returns unquoted identifiers uppercase, so table/column names
// here are deliberately left unquoted (not "wrapped") rather than quoted like
// Postgres/MySQL — sanitizeIdentifier's character allowlist already makes
// this injection-safe either way, and leaving them unquoted lets Oracle's
// normal case-insensitive resolution match whatever case the user typed.
async function extractOracle(input: DbTestInput, table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const oracledb = await import('oracledb');
  const safeTable = sanitizeIdentifier(table).join('.');
  const colList = columns.map((c) => sanitizeIdentifier(c)[0]).join(', ');
  const connection = await oracledb.getConnection({
    user: input.username, password: input.password,
    connectString: `${input.host}:${input.port || 1521}/${input.database}`,
  });
  try {
    const result = await connection.execute<Record<string, unknown>>(
      `SELECT ${colList} FROM ${safeTable} FETCH FIRST ${MAX_SYNC_ROWS} ROWS ONLY`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows ?? [];
  } finally {
    await connection.close().catch(() => {});
  }
}

// There's no server-side column projection for a flat file the way SQL's
// SELECT col1, col2 does it, so this fetches everything and picks out the
// requested columns client-side.
async function extractS3(input: DbTestInput, table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const rows = await extractAllColumnsS3(input, table);
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c] = row[c];
    return out;
  });
}

async function extractAzure(input: DbTestInput, table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const rows = await extractAllColumnsAzure(input, table);
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c] = row[c];
    return out;
  });
}

async function extractGcs(input: DbTestInput, table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const rows = await extractAllColumnsGcs(input, table);
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c] = row[c];
    return out;
  });
}

export async function extractRows(input: DbTestInput, table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  switch (input.type) {
    case 'mssql': return extractMssql(input, table, columns);
    case 'postgresql':
    case 'supabase': return extractPostgres(input, table, columns);
    case 'mysql': return extractMysql(input, table, columns);
    case 'oracle': return extractOracle(input, table, columns);
    case 's3': return extractS3(input, table, columns);
    case 'azure_blob': return extractAzure(input, table, columns);
    case 'gcs': return extractGcs(input, table, columns);
    default: throw new Error(`Data extraction for ${input.type} is not implemented yet.`);
  }
}

async function extractAllColumnsMssql(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const sql = (await import('mssql')).default;
  const safeTable = sanitizeIdentifier(table).map((p) => `[${p}]`).join('.');
  const pool = new sql.ConnectionPool({
    server: input.host, port: input.port || 1433, database: input.database,
    user: input.username, password: input.password, connectionTimeout: TIMEOUT_MS,
    options: mssqlOptions(input.host),
  });
  try {
    await pool.connect();
    const result = await pool.request().query(`SELECT TOP (${MAX_SYNC_ROWS}) * FROM ${safeTable}`);
    return result.recordset;
  } finally {
    await pool.close().catch(() => {});
  }
}

async function extractAllColumnsPostgres(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const { Client } = await import('pg');
  const safeTable = sanitizeIdentifier(table).map((p) => `"${p}"`).join('.');
  const client = new Client({
    host: input.host, port: input.port || 5432, database: input.database,
    user: input.username, password: input.password, connectionTimeoutMillis: TIMEOUT_MS,
    ssl: input.type === 'supabase' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await client.connect();
    const result = await client.query(`SELECT * FROM ${safeTable} LIMIT ${MAX_SYNC_ROWS}`);
    return result.rows;
  } finally {
    await client.end().catch(() => {});
  }
}

async function extractAllColumnsMysql(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const mysql = await import('mysql2/promise');
  const safeTable = sanitizeIdentifier(table).map((p) => `\`${p}\``).join('.');
  const connection = await mysql.createConnection({
    host: input.host, port: input.port || 3306, database: input.database,
    user: input.username, password: input.password, connectTimeout: TIMEOUT_MS,
  });
  try {
    const [rows] = await connection.query(`SELECT * FROM ${safeTable} LIMIT ${MAX_SYNC_ROWS}`);
    return rows as Record<string, unknown>[];
  } finally {
    await connection.end().catch(() => {});
  }
}

// Used for JOIN sources only: unlike UNION sources (whose needed columns are
// already fully described by the pipeline's schema mapping), a joined
// source's useful columns aren't known in advance, so every column comes
// back and only the ones a mapping actually references end up loaded.
async function extractAllColumnsOracle(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const oracledb = await import('oracledb');
  const safeTable = sanitizeIdentifier(table).join('.');
  const connection = await oracledb.getConnection({
    user: input.username, password: input.password,
    connectString: `${input.host}:${input.port || 1521}/${input.database}`,
  });
  try {
    const result = await connection.execute<Record<string, unknown>>(
      `SELECT * FROM ${safeTable} FETCH FIRST ${MAX_SYNC_ROWS} ROWS ONLY`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows ?? [];
  } finally {
    await connection.close().catch(() => {});
  }
}

async function extractAllColumnsS3(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await createS3Client(input);
  const result = await client.send(new GetObjectCommand({ Bucket: input.database, Key: table }));
  const body = (await result.Body?.transformToString('utf-8')) ?? '';
  return parseS3Rows(table, body).slice(0, MAX_SYNC_ROWS);
}

async function extractAllColumnsAzure(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const containerClient = await createAzureContainerClient(input);
  const download = await containerClient.getBlobClient(table).download();
  const body = download.readableStreamBody ? await streamToString(download.readableStreamBody) : '';
  return parseS3Rows(table, body).slice(0, MAX_SYNC_ROWS);
}

async function extractAllColumnsGcs(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const bucket = await createGcsBucket(input);
  const [contents] = await bucket.file(table).download();
  return parseS3Rows(table, contents.toString('utf-8')).slice(0, MAX_SYNC_ROWS);
}

async function extractAllColumns(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  switch (input.type) {
    case 'mssql': return extractAllColumnsMssql(input, table);
    case 'postgresql':
    case 'supabase': return extractAllColumnsPostgres(input, table);
    case 'mysql': return extractAllColumnsMysql(input, table);
    case 'oracle': return extractAllColumnsOracle(input, table);
    case 's3': return extractAllColumnsS3(input, table);
    case 'azure_blob': return extractAllColumnsAzure(input, table);
    case 'gcs': return extractAllColumnsGcs(input, table);
    default: throw new Error(`Data extraction for ${input.type} is not implemented yet.`);
  }
}

async function insertMssql(input: DbTestInput, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number> {
  const sql = (await import('mssql')).default;
  const safeTable = sanitizeIdentifier(table).map((p) => `[${p}]`).join('.');
  const safeCols = columns.map((c) => sanitizeIdentifier(c)[0]);
  const pool = new sql.ConnectionPool({
    server: input.host, port: input.port || 1433, database: input.database,
    user: input.username, password: input.password, connectionTimeout: TIMEOUT_MS,
    options: mssqlOptions(input.host),
  });
  try {
    await pool.connect();
    const colList = safeCols.map((c) => `[${c}]`).join(', ');
    const paramList = safeCols.map((c) => `@${c}`).join(', ');
    let inserted = 0;
    for (const row of rows) {
      const request = pool.request();
      safeCols.forEach((c) => request.input(c, row[c] ?? null));
      await request.query(`INSERT INTO ${safeTable} (${colList}) VALUES (${paramList})`);
      inserted += 1;
    }
    return inserted;
  } finally {
    await pool.close().catch(() => {});
  }
}

async function insertPostgres(input: DbTestInput, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number> {
  const { Client } = await import('pg');
  const safeTable = sanitizeIdentifier(table).map((p) => `"${p}"`).join('.');
  const safeCols = columns.map((c) => sanitizeIdentifier(c)[0]);
  const client = new Client({
    host: input.host, port: input.port || 5432, database: input.database,
    user: input.username, password: input.password, connectionTimeoutMillis: TIMEOUT_MS,
    ssl: input.type === 'supabase' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await client.connect();
    const colList = safeCols.map((c) => `"${c}"`).join(', ');
    const placeholders = safeCols.map((_, i) => `$${i + 1}`).join(', ');
    let inserted = 0;
    for (const row of rows) {
      await client.query(`INSERT INTO ${safeTable} (${colList}) VALUES (${placeholders})`, safeCols.map((c) => row[c] ?? null));
      inserted += 1;
    }
    return inserted;
  } finally {
    await client.end().catch(() => {});
  }
}

async function insertMysql(input: DbTestInput, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number> {
  const mysql = await import('mysql2/promise');
  const safeTable = sanitizeIdentifier(table).map((p) => `\`${p}\``).join('.');
  const safeCols = columns.map((c) => sanitizeIdentifier(c)[0]);
  const connection = await mysql.createConnection({
    host: input.host, port: input.port || 3306, database: input.database,
    user: input.username, password: input.password, connectTimeout: TIMEOUT_MS,
  });
  try {
    const colList = safeCols.map((c) => `\`${c}\``).join(', ');
    const placeholders = safeCols.map(() => '?').join(', ');
    let inserted = 0;
    for (const row of rows) {
      await connection.query(`INSERT INTO ${safeTable} (${colList}) VALUES (${placeholders})`, safeCols.map((c) => row[c] ?? null));
      inserted += 1;
    }
    return inserted;
  } finally {
    await connection.end().catch(() => {});
  }
}

async function insertOracle(input: DbTestInput, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number> {
  const oracledb = await import('oracledb');
  const safeTable = sanitizeIdentifier(table).join('.');
  const safeCols = columns.map((c) => sanitizeIdentifier(c)[0]);
  const connection = await oracledb.getConnection({
    user: input.username, password: input.password,
    connectString: `${input.host}:${input.port || 1521}/${input.database}`,
  });
  try {
    const colList = safeCols.join(', ');
    const paramList = safeCols.map((c) => `:${c}`).join(', ');
    let inserted = 0;
    for (const row of rows) {
      const binds: Record<string, string | number | boolean | Date | Buffer | null> = {};
      safeCols.forEach((c) => { binds[c] = (row[c] ?? null) as string | number | boolean | Date | Buffer | null; });
      await connection.execute(`INSERT INTO ${safeTable} (${colList}) VALUES (${paramList})`, binds, { autoCommit: true });
      inserted += 1;
    }
    return inserted;
  } finally {
    await connection.close().catch(() => {});
  }
}

// SQL "insert" is naturally additive; a flat file isn't, so this reads
// whatever's already at the key (if anything — a fresh key or one just
// cleared by truncateS3 is empty), appends the new rows, and rewrites the
// whole object. truncateTable() already runs before this in runSync() for
// truncate_reload mode, so this function itself only ever needs to append.
async function insertS3(input: DbTestInput, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number> {
  const { GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await createS3Client(input);
  let existing: Record<string, unknown>[] = [];
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: input.database, Key: table }));
    const body = (await result.Body?.transformToString('utf-8')) ?? '';
    existing = parseS3Rows(table, body);
  } catch {
    // Key doesn't exist yet — starting fresh.
  }
  const projected = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c] = row[c] ?? null;
    return out;
  });
  const combined = existing.concat(projected);
  await client.send(new PutObjectCommand({ Bucket: input.database, Key: table, Body: serializeS3Rows(table, combined) }));
  return projected.length;
}

async function insertAzure(input: DbTestInput, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number> {
  const containerClient = await createAzureContainerClient(input);
  let existing: Record<string, unknown>[] = [];
  try {
    const download = await containerClient.getBlobClient(table).download();
    const body = download.readableStreamBody ? await streamToString(download.readableStreamBody) : '';
    existing = parseS3Rows(table, body);
  } catch {
    // Blob doesn't exist yet — starting fresh.
  }
  const projected = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c] = row[c] ?? null;
    return out;
  });
  const combined = existing.concat(projected);
  const content = serializeS3Rows(table, combined);
  await containerClient.getBlockBlobClient(table).upload(content, Buffer.byteLength(content, 'utf-8'));
  return projected.length;
}

async function insertGcs(input: DbTestInput, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number> {
  const bucket = await createGcsBucket(input);
  let existing: Record<string, unknown>[] = [];
  try {
    const [contents] = await bucket.file(table).download();
    existing = parseS3Rows(table, contents.toString('utf-8'));
  } catch {
    // Object doesn't exist yet — starting fresh.
  }
  const projected = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c] = row[c] ?? null;
    return out;
  });
  const combined = existing.concat(projected);
  await bucket.file(table).save(serializeS3Rows(table, combined));
  return projected.length;
}

export async function insertRows(input: DbTestInput, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number> {
  switch (input.type) {
    case 'mssql': return insertMssql(input, table, columns, rows);
    case 'postgresql':
    case 'supabase': return insertPostgres(input, table, columns, rows);
    case 'mysql': return insertMysql(input, table, columns, rows);
    case 'oracle': return insertOracle(input, table, columns, rows);
    case 's3': return insertS3(input, table, columns, rows);
    case 'azure_blob': return insertAzure(input, table, columns, rows);
    case 'gcs': return insertGcs(input, table, columns, rows);
    default: throw new Error(`Data loading for ${input.type} is not implemented yet.`);
  }
}

async function truncateMssql(input: DbTestInput, table: string): Promise<void> {
  const sql = (await import('mssql')).default;
  const safeTable = sanitizeIdentifier(table).map((p) => `[${p}]`).join('.');
  const pool = new sql.ConnectionPool({
    server: input.host, port: input.port || 1433, database: input.database,
    user: input.username, password: input.password, connectionTimeout: TIMEOUT_MS,
    options: mssqlOptions(input.host),
  });
  try {
    await pool.connect();
    await pool.request().query(`TRUNCATE TABLE ${safeTable}`);
  } finally {
    await pool.close().catch(() => {});
  }
}

async function truncatePostgres(input: DbTestInput, table: string): Promise<void> {
  const { Client } = await import('pg');
  const safeTable = sanitizeIdentifier(table).map((p) => `"${p}"`).join('.');
  const client = new Client({
    host: input.host, port: input.port || 5432, database: input.database,
    user: input.username, password: input.password, connectionTimeoutMillis: TIMEOUT_MS,
    ssl: input.type === 'supabase' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await client.connect();
    await client.query(`TRUNCATE TABLE ${safeTable}`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function truncateMysql(input: DbTestInput, table: string): Promise<void> {
  const mysql = await import('mysql2/promise');
  const safeTable = sanitizeIdentifier(table).map((p) => `\`${p}\``).join('.');
  const connection = await mysql.createConnection({
    host: input.host, port: input.port || 3306, database: input.database,
    user: input.username, password: input.password, connectTimeout: TIMEOUT_MS,
  });
  try {
    await connection.query(`TRUNCATE TABLE ${safeTable}`);
  } finally {
    await connection.end().catch(() => {});
  }
}

async function truncateOracle(input: DbTestInput, table: string): Promise<void> {
  const oracledb = await import('oracledb');
  const safeTable = sanitizeIdentifier(table).join('.');
  const connection = await oracledb.getConnection({
    user: input.username, password: input.password,
    connectString: `${input.host}:${input.port || 1521}/${input.database}`,
  });
  try {
    // TRUNCATE is DDL in Oracle and auto-commits implicitly.
    await connection.execute(`TRUNCATE TABLE ${safeTable}`);
  } finally {
    await connection.close().catch(() => {});
  }
}

async function truncateS3(input: DbTestInput, table: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await createS3Client(input);
  await client.send(new DeleteObjectCommand({ Bucket: input.database, Key: table }));
}

async function truncateAzure(input: DbTestInput, table: string): Promise<void> {
  const containerClient = await createAzureContainerClient(input);
  await containerClient.getBlobClient(table).deleteIfExists();
}

async function truncateGcs(input: DbTestInput, table: string): Promise<void> {
  const bucket = await createGcsBucket(input);
  await bucket.file(table).delete({ ignoreNotFound: true });
}

async function truncateTable(input: DbTestInput, table: string): Promise<void> {
  switch (input.type) {
    case 'mssql': return truncateMssql(input, table);
    case 'postgresql':
    case 'supabase': return truncatePostgres(input, table);
    case 'mysql': return truncateMysql(input, table);
    case 'oracle': return truncateOracle(input, table);
    case 's3': return truncateS3(input, table);
    case 'azure_blob': return truncateAzure(input, table);
    case 'gcs': return truncateGcs(input, table);
    default: throw new Error(`Truncate is not implemented for ${input.type}.`);
  }
}

export type SyncMode = 'append' | 'truncate_reload';
export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';

// Structured (column/operator/value) rather than free-form SQL, so a filter
// can't reopen the injection surface the identifier allowlisting above closes.
export function matchesFilter(row: Record<string, unknown>, column: string, operator: FilterOperator, value: string): boolean {
  const actual = row[column];
  const actualStr = actual === null || actual === undefined ? '' : String(actual);
  switch (operator) {
    case '=': return actualStr === value;
    case '!=': return actualStr !== value;
    case '>': return Number(actual) > Number(value);
    case '<': return Number(actual) < Number(value);
    case '>=': return Number(actual) >= Number(value);
    case '<=': return Number(actual) <= Number(value);
    case 'contains': return actualStr.toLowerCase().includes(value.toLowerCase());
    default: return false;
  }
}

// Real measurement of the serialized row payload actually moved, not an estimate.
function byteSize(rows: Record<string, unknown>[]): number {
  return rows.reduce((sum, row) => sum + Buffer.byteLength(JSON.stringify(row), 'utf8'), 0);
}

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: string;
}

export type MatchMode = 'all' | 'any';

// A destination is sent the rows matching all its conditions (AND) or any
// of them (OR), per matchMode.
export function matchesConditions(row: Record<string, unknown>, conditions: FilterCondition[], matchMode: MatchMode): boolean {
  if (conditions.length === 0) return true;
  return matchMode === 'any'
    ? conditions.some((c) => matchesFilter(row, c.column, c.operator, c.value))
    : conditions.every((c) => matchesFilter(row, c.column, c.operator, c.value));
}

export interface DestinationSyncInput {
  id: string;
  target: DbTestInput;
  targetTable: string;
  conditions: FilterCondition[];
  matchMode: MatchMode;
}

export interface DestinationSyncResult {
  destinationId: string;
  recordsLoaded: number;
  bytesTransferred: number;
}

export interface SyncResult {
  recordsExtracted: number;
  recordsLoaded: number;
  bytesTransferred: number;
  destinationResults: DestinationSyncResult[];
}

const PREVIEW_ROWS = 25;

async function previewMssql(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const sql = (await import('mssql')).default;
  const safeTable = sanitizeIdentifier(table).map((p) => `[${p}]`).join('.');
  const pool = new sql.ConnectionPool({
    server: input.host, port: input.port || 1433, database: input.database,
    user: input.username, password: input.password, connectionTimeout: TIMEOUT_MS,
    options: mssqlOptions(input.host),
  });
  try {
    await pool.connect();
    const result = await pool.request().query(`SELECT TOP (${PREVIEW_ROWS}) * FROM ${safeTable}`);
    return result.recordset;
  } finally {
    await pool.close().catch(() => {});
  }
}

async function previewPostgres(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const { Client } = await import('pg');
  const safeTable = sanitizeIdentifier(table).map((p) => `"${p}"`).join('.');
  const client = new Client({
    host: input.host, port: input.port || 5432, database: input.database,
    user: input.username, password: input.password, connectionTimeoutMillis: TIMEOUT_MS,
    ssl: input.type === 'supabase' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await client.connect();
    const result = await client.query(`SELECT * FROM ${safeTable} LIMIT ${PREVIEW_ROWS}`);
    return result.rows;
  } finally {
    await client.end().catch(() => {});
  }
}

async function previewMysql(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const mysql = await import('mysql2/promise');
  const safeTable = sanitizeIdentifier(table).map((p) => `\`${p}\``).join('.');
  const connection = await mysql.createConnection({
    host: input.host, port: input.port || 3306, database: input.database,
    user: input.username, password: input.password, connectTimeout: TIMEOUT_MS,
  });
  try {
    const [rows] = await connection.query(`SELECT * FROM ${safeTable} LIMIT ${PREVIEW_ROWS}`);
    return rows as Record<string, unknown>[];
  } finally {
    await connection.end().catch(() => {});
  }
}

async function previewOracle(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const oracledb = await import('oracledb');
  const safeTable = sanitizeIdentifier(table).join('.');
  const connection = await oracledb.getConnection({
    user: input.username, password: input.password,
    connectString: `${input.host}:${input.port || 1521}/${input.database}`,
  });
  try {
    const result = await connection.execute<Record<string, unknown>>(
      `SELECT * FROM ${safeTable} FETCH FIRST ${PREVIEW_ROWS} ROWS ONLY`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows ?? [];
  } finally {
    await connection.close().catch(() => {});
  }
}

async function previewS3(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await createS3Client(input);
  const result = await client.send(new GetObjectCommand({ Bucket: input.database, Key: table }));
  const body = (await result.Body?.transformToString('utf-8')) ?? '';
  return parseS3Rows(table, body).slice(0, PREVIEW_ROWS);
}

async function previewAzure(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const containerClient = await createAzureContainerClient(input);
  const download = await containerClient.getBlobClient(table).download();
  const body = download.readableStreamBody ? await streamToString(download.readableStreamBody) : '';
  return parseS3Rows(table, body).slice(0, PREVIEW_ROWS);
}

async function previewGcs(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  const bucket = await createGcsBucket(input);
  const [contents] = await bucket.file(table).download();
  return parseS3Rows(table, contents.toString('utf-8')).slice(0, PREVIEW_ROWS);
}

export async function previewTable(input: DbTestInput, table: string): Promise<Record<string, unknown>[]> {
  switch (input.type) {
    case 'mssql': return previewMssql(input, table);
    case 'postgresql':
    case 'supabase': return previewPostgres(input, table);
    case 'mysql': return previewMysql(input, table);
    case 'oracle': return previewOracle(input, table);
    case 's3': return previewS3(input, table);
    case 'azure_blob': return previewAzure(input, table);
    case 'gcs': return previewGcs(input, table);
    default: throw new Error(`Data preview for ${input.type} is not implemented yet.`);
  }
}

export type CombineMode = 'union' | 'join';

export interface AdditionalSourceInput {
  source: DbTestInput;
  sourceTable: string;
  combineMode: CombineMode;
  // join-only: this source's key column, and the matching column on the
  // working row set (the primary source, or the result of any earlier join —
  // joins apply in the order given, same as chaining SQL `A JOIN B JOIN C`).
  joinColumn?: string;
  primaryJoinColumn?: string;
  joinType?: 'inner' | 'left';
}

export async function runSync(
  source: DbTestInput,
  sourceTable: string,
  target: DbTestInput,
  targetTable: string,
  mappings: ColumnMapping[],
  syncMode: SyncMode = 'append',
  additionalSources: AdditionalSourceInput[] = [],
  destinations: DestinationSyncInput[] = []
): Promise<SyncResult> {
  const sourceCols = mappings.map((m) => m.source_col);

  // When a join is configured, some mapped columns may live on the joined
  // source rather than the primary one, so the primary extraction can't be
  // restricted to sourceCols (it would try to SELECT a column that doesn't
  // exist on the primary table) — pull every column instead and let the
  // final remap step pick out whatever each mapping actually references.
  const hasJoins = additionalSources.some((s) => s.combineMode === 'join');
  let rows = hasJoins
    ? await extractAllColumns(source, sourceTable)
    : await extractRows(source, sourceTable, sourceCols);

  // JOIN sources: a real cross-engine SQL JOIN can't run here (sources may be
  // on entirely different physical database servers), so each joined source
  // is extracted independently (every column — its useful columns aren't
  // known in advance the way a UNION source's are) and merged in memory by
  // matching key. Primary-side fields win on name conflicts so a join can
  // enrich a row but never silently overwrite the columns the schema mapping
  // already resolved.
  for (const j of additionalSources.filter((s) => s.combineMode === 'join')) {
    const joinRows = await extractAllColumns(j.source, j.sourceTable);
    const joinIndex = new Map<string, Record<string, unknown>[]>();
    for (const jr of joinRows) {
      const key = String(jr[j.joinColumn!] ?? '');
      const bucket = joinIndex.get(key);
      if (bucket) bucket.push(jr); else joinIndex.set(key, [jr]);
    }
    const merged: Record<string, unknown>[] = [];
    for (const row of rows) {
      const key = String(row[j.primaryJoinColumn!] ?? '');
      const matches = joinIndex.get(key);
      if (matches && matches.length > 0) {
        for (const m of matches) merged.push({ ...m, ...row });
      } else if (j.joinType === 'left') {
        merged.push(row);
      }
      // inner join, no match: row dropped
    }
    rows = merged;
  }

  // UNION ALL semantics: extract every union source independently (each
  // already capped at MAX_SYNC_ROWS) and concatenate, then cap the combined
  // total again to keep the overall row count bounded.
  const unionSources = additionalSources.filter((s) => s.combineMode === 'union');
  const unionExtracted = await Promise.all(unionSources.map((s) => extractRows(s.source, s.sourceTable, sourceCols)));
  rows = rows.concat(unionExtracted.flat()).slice(0, MAX_SYNC_ROWS);

  const remap = (subset: Record<string, unknown>[]) => subset.map((row) => {
    const out: Record<string, unknown> = {};
    for (const m of mappings) {
      out[m.target_col] = row[m.source_col];
    }
    return out;
  });

  const targetCols = mappings.map((m) => m.target_col);
  const remapped = remap(rows);

  if (syncMode === 'truncate_reload') {
    await truncateTable(target, targetTable);
  }
  const inserted = remapped.length > 0 ? await insertRows(target, targetTable, targetCols, remapped) : 0;
  const bytesTransferred = byteSize(remapped);

  const destinationResults: DestinationSyncResult[] = [];
  for (const dest of destinations) {
    const filteredRows = rows.filter((row) => matchesConditions(row, dest.conditions, dest.matchMode));
    const filteredRemapped = remap(filteredRows);
    const destInserted = filteredRemapped.length > 0 ? await insertRows(dest.target, dest.targetTable, targetCols, filteredRemapped) : 0;
    destinationResults.push({
      destinationId: dest.id,
      recordsLoaded: destInserted,
      bytesTransferred: byteSize(filteredRemapped),
    });
  }

  return { recordsExtracted: rows.length, recordsLoaded: inserted, bytesTransferred, destinationResults };
}
