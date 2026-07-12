import type { DbTestInput } from './db-test';

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

const TIMEOUT_MS = 8000;

async function listTablesMssql(input: DbTestInput): Promise<string[]> {
  const sql = (await import('mssql')).default;
  const pool = new sql.ConnectionPool({
    server: input.host, port: input.port || 1433, database: input.database,
    user: input.username, password: input.password, connectionTimeout: TIMEOUT_MS,
    options: { encrypt: true, trustServerCertificate: true },
  });
  try {
    await pool.connect();
    const result = await pool.request().query(
      `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME`
    );
    return result.recordset.map((r: { TABLE_SCHEMA: string; TABLE_NAME: string }) =>
      r.TABLE_SCHEMA === 'dbo' ? r.TABLE_NAME : `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`
    );
  } finally {
    await pool.close().catch(() => {});
  }
}

async function listTablesPostgres(input: DbTestInput): Promise<string[]> {
  const { Client } = await import('pg');
  const client = new Client({
    host: input.host, port: input.port || 5432, database: input.database,
    user: input.username, password: input.password, connectionTimeoutMillis: TIMEOUT_MS,
    ssl: input.type === 'supabase' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name`
    );
    return result.rows.map((r: { table_schema: string; table_name: string }) =>
      r.table_schema === 'public' ? r.table_name : `${r.table_schema}.${r.table_name}`
    );
  } finally {
    await client.end().catch(() => {});
  }
}

async function listTablesMysql(input: DbTestInput): Promise<string[]> {
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection({
    host: input.host, port: input.port || 3306, database: input.database,
    user: input.username, password: input.password, connectTimeout: TIMEOUT_MS,
  });
  try {
    const [rows] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [input.database]
    );
    return (rows as { TABLE_NAME: string }[]).map((r) => r.TABLE_NAME);
  } finally {
    await connection.end().catch(() => {});
  }
}

function splitSchemaTable(tableName: string, defaultSchema: string): [string, string] {
  const parts = tableName.split('.');
  return parts.length > 1 ? [parts[0], parts[1]] : [defaultSchema, parts[0]];
}

async function getColumnsMssql(input: DbTestInput, tableName: string): Promise<ColumnInfo[]> {
  const sql = (await import('mssql')).default;
  const [schema, name] = splitSchemaTable(tableName, 'dbo');
  const pool = new sql.ConnectionPool({
    server: input.host, port: input.port || 1433, database: input.database,
    user: input.username, password: input.password, connectionTimeout: TIMEOUT_MS,
    options: { encrypt: true, trustServerCertificate: true },
  });
  try {
    await pool.connect();
    const result = await pool.request()
      .input('schema', sql.NVarChar, schema)
      .input('name', sql.NVarChar, name)
      .query(`SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@schema AND TABLE_NAME=@name ORDER BY ORDINAL_POSITION`);
    return result.recordset.map((r: { COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string }) => ({
      name: r.COLUMN_NAME, type: r.DATA_TYPE, nullable: r.IS_NULLABLE === 'YES',
    }));
  } finally {
    await pool.close().catch(() => {});
  }
}

async function getColumnsPostgres(input: DbTestInput, tableName: string): Promise<ColumnInfo[]> {
  const { Client } = await import('pg');
  const [schema, name] = splitSchemaTable(tableName, 'public');
  const client = new Client({
    host: input.host, port: input.port || 5432, database: input.database,
    user: input.username, password: input.password, connectionTimeoutMillis: TIMEOUT_MS,
    ssl: input.type === 'supabase' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schema, name]
    );
    return result.rows.map((r: { column_name: string; data_type: string; is_nullable: string }) => ({
      name: r.column_name, type: r.data_type, nullable: r.is_nullable === 'YES',
    }));
  } finally {
    await client.end().catch(() => {});
  }
}

async function getColumnsMysql(input: DbTestInput, tableName: string): Promise<ColumnInfo[]> {
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection({
    host: input.host, port: input.port || 3306, database: input.database,
    user: input.username, password: input.password, connectTimeout: TIMEOUT_MS,
  });
  try {
    const [rows] = await connection.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
      [input.database, tableName]
    );
    return (rows as { COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string }[]).map((r) => ({
      name: r.COLUMN_NAME, type: r.DATA_TYPE, nullable: r.IS_NULLABLE === 'YES',
    }));
  } finally {
    await connection.end().catch(() => {});
  }
}

export async function listTables(input: DbTestInput): Promise<string[]> {
  switch (input.type) {
    case 'mssql': return listTablesMssql(input);
    case 'postgresql':
    case 'supabase': return listTablesPostgres(input);
    case 'mysql': return listTablesMysql(input);
    default: throw new Error(`Schema introspection for ${input.type} is not implemented yet.`);
  }
}

export async function getColumns(input: DbTestInput, tableName: string): Promise<ColumnInfo[]> {
  switch (input.type) {
    case 'mssql': return getColumnsMssql(input, tableName);
    case 'postgresql':
    case 'supabase': return getColumnsPostgres(input, tableName);
    case 'mysql': return getColumnsMysql(input, tableName);
    default: throw new Error(`Schema introspection for ${input.type} is not implemented yet.`);
  }
}
