import type { DbTestInput } from './db-test';
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
    options: { encrypt: true, trustServerCertificate: true },
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

export async function extractRows(input: DbTestInput, table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  switch (input.type) {
    case 'mssql': return extractMssql(input, table, columns);
    case 'postgresql': return extractPostgres(input, table, columns);
    case 'mysql': return extractMysql(input, table, columns);
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
    options: { encrypt: true, trustServerCertificate: true },
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

export async function insertRows(input: DbTestInput, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number> {
  switch (input.type) {
    case 'mssql': return insertMssql(input, table, columns, rows);
    case 'postgresql': return insertPostgres(input, table, columns, rows);
    case 'mysql': return insertMysql(input, table, columns, rows);
    default: throw new Error(`Data loading for ${input.type} is not implemented yet.`);
  }
}

export interface SyncResult {
  recordsExtracted: number;
  recordsLoaded: number;
  bytesTransferred: number;
}

export async function runSync(
  source: DbTestInput,
  sourceTable: string,
  target: DbTestInput,
  targetTable: string,
  mappings: ColumnMapping[]
): Promise<SyncResult> {
  const sourceCols = mappings.map((m) => m.source_col);
  const rows = await extractRows(source, sourceTable, sourceCols);

  const remapped = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const m of mappings) {
      out[m.target_col] = row[m.source_col];
    }
    return out;
  });

  const targetCols = mappings.map((m) => m.target_col);
  const inserted = remapped.length > 0 ? await insertRows(target, targetTable, targetCols, remapped) : 0;

  // Real measurement of the serialized row payload actually moved, not an estimate.
  const bytesTransferred = remapped.reduce((sum, row) => sum + Buffer.byteLength(JSON.stringify(row), 'utf8'), 0);

  return { recordsExtracted: rows.length, recordsLoaded: inserted, bytesTransferred };
}
