import { mssqlOptions, createS3Client, parseS3Rows, createAzureContainerClient, streamToString, createGcsBucket, type DbTestInput } from './db-test';

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
    options: mssqlOptions(input.host),
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

async function listTablesOracle(input: DbTestInput): Promise<string[]> {
  const oracledb = await import('oracledb');
  const connection = await oracledb.getConnection({
    user: input.username, password: input.password,
    connectString: `${input.host}:${input.port || 1521}/${input.database}`,
  });
  try {
    // USER_TABLES scopes to tables owned by the connecting user, matching how
    // Oracle equates "schema" with "user" (unlike Postgres/MySQL, where
    // schema and user are independent).
    const result = await connection.execute<{ TABLE_NAME: string }>(
      `SELECT table_name AS "TABLE_NAME" FROM user_tables ORDER BY table_name`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return (result.rows ?? []).map((r) => r.TABLE_NAME);
  } finally {
    await connection.close().catch(() => {});
  }
}

// "Tables" for an S3 connector are individual .csv/.json object keys in the
// bucket, not a schema-level concept — every matching key is listed as one.
async function listTablesS3(input: DbTestInput): Promise<string[]> {
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const client = await createS3Client(input);
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const result = await client.send(new ListObjectsV2Command({ Bucket: input.database, ContinuationToken: continuationToken }));
    for (const obj of result.Contents ?? []) {
      if (obj.Key && /\.(csv|json)$/i.test(obj.Key)) keys.push(obj.Key);
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys.sort();
}

async function getColumnsS3(input: DbTestInput, tableName: string): Promise<ColumnInfo[]> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await createS3Client(input);
  let body = '';
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: input.database, Key: tableName }));
    body = (await result.Body?.transformToString('utf-8')) ?? '';
  } catch {
    // A sync target commonly doesn't exist yet on its first run — there's no
    // file-based equivalent of "CREATE TABLE" to pre-declare its columns, so
    // an absent key just means "no columns known yet" rather than an error.
    return [];
  }
  // CSV: read the header row directly so a file with a header but zero data
  // rows (the object-storage equivalent of an empty pre-created table) still
  // reports its real columns, rather than only inferring from sample data.
  if (tableName.toLowerCase().endsWith('.csv')) {
    const headerLine = body.split(/\r?\n/).find((l) => l.length > 0);
    if (!headerLine) return [];
    return headerLine.split(',').map((name) => ({ name: name.trim(), type: 'text', nullable: true }));
  }
  const sample = parseS3Rows(tableName, body)[0] ?? {};
  return Object.keys(sample).map((name) => {
    const value = sample[name];
    const type = typeof value === 'number' ? 'numeric' : typeof value === 'boolean' ? 'boolean' : 'text';
    return { name, type, nullable: true };
  });
}

async function listTablesAzure(input: DbTestInput): Promise<string[]> {
  const containerClient = await createAzureContainerClient(input);
  const keys: string[] = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    if (/\.(csv|json)$/i.test(blob.name)) keys.push(blob.name);
  }
  return keys.sort();
}

async function getColumnsAzure(input: DbTestInput, tableName: string): Promise<ColumnInfo[]> {
  const containerClient = await createAzureContainerClient(input);
  let body = '';
  try {
    const download = await containerClient.getBlobClient(tableName).download();
    body = download.readableStreamBody ? await streamToString(download.readableStreamBody) : '';
  } catch {
    return [];
  }
  if (tableName.toLowerCase().endsWith('.csv')) {
    const headerLine = body.split(/\r?\n/).find((l) => l.length > 0);
    if (!headerLine) return [];
    return headerLine.split(',').map((name) => ({ name: name.trim(), type: 'text', nullable: true }));
  }
  const sample = parseS3Rows(tableName, body)[0] ?? {};
  return Object.keys(sample).map((name) => {
    const value = sample[name];
    const type = typeof value === 'number' ? 'numeric' : typeof value === 'boolean' ? 'boolean' : 'text';
    return { name, type, nullable: true };
  });
}

async function listTablesGcs(input: DbTestInput): Promise<string[]> {
  const bucket = await createGcsBucket(input);
  const [files] = await bucket.getFiles();
  return files.map((f) => f.name).filter((name) => /\.(csv|json)$/i.test(name)).sort();
}

async function getColumnsGcs(input: DbTestInput, tableName: string): Promise<ColumnInfo[]> {
  const bucket = await createGcsBucket(input);
  let body = '';
  try {
    const [contents] = await bucket.file(tableName).download();
    body = contents.toString('utf-8');
  } catch {
    return [];
  }
  if (tableName.toLowerCase().endsWith('.csv')) {
    const headerLine = body.split(/\r?\n/).find((l) => l.length > 0);
    if (!headerLine) return [];
    return headerLine.split(',').map((name) => ({ name: name.trim(), type: 'text', nullable: true }));
  }
  const sample = parseS3Rows(tableName, body)[0] ?? {};
  return Object.keys(sample).map((name) => {
    const value = sample[name];
    const type = typeof value === 'number' ? 'numeric' : typeof value === 'boolean' ? 'boolean' : 'text';
    return { name, type, nullable: true };
  });
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
    options: mssqlOptions(input.host),
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

async function getColumnsOracle(input: DbTestInput, tableName: string): Promise<ColumnInfo[]> {
  const oracledb = await import('oracledb');
  // listTablesOracle only returns bare (unqualified) names for the connecting
  // user, so a dot-qualified name here just means "take the table part".
  const name = tableName.includes('.') ? tableName.split('.')[1] : tableName;
  const connection = await oracledb.getConnection({
    user: input.username, password: input.password,
    connectString: `${input.host}:${input.port || 1521}/${input.database}`,
  });
  try {
    const result = await connection.execute<{ COLUMN_NAME: string; DATA_TYPE: string; NULLABLE: string }>(
      `SELECT column_name AS "COLUMN_NAME", data_type AS "DATA_TYPE", nullable AS "NULLABLE"
       FROM user_tab_columns WHERE table_name = UPPER(:name) ORDER BY column_id`,
      { name }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return (result.rows ?? []).map((r) => ({ name: r.COLUMN_NAME, type: r.DATA_TYPE, nullable: r.NULLABLE === 'Y' }));
  } finally {
    await connection.close().catch(() => {});
  }
}

export async function listTables(input: DbTestInput): Promise<string[]> {
  switch (input.type) {
    case 'mssql': return listTablesMssql(input);
    case 'postgresql':
    case 'supabase': return listTablesPostgres(input);
    case 'mysql': return listTablesMysql(input);
    case 'oracle': return listTablesOracle(input);
    case 's3': return listTablesS3(input);
    case 'azure_blob': return listTablesAzure(input);
    case 'gcs': return listTablesGcs(input);
    default: throw new Error(`Schema introspection for ${input.type} is not implemented yet.`);
  }
}

export async function getColumns(input: DbTestInput, tableName: string): Promise<ColumnInfo[]> {
  switch (input.type) {
    case 'mssql': return getColumnsMssql(input, tableName);
    case 'postgresql':
    case 'supabase': return getColumnsPostgres(input, tableName);
    case 'mysql': return getColumnsMysql(input, tableName);
    case 'oracle': return getColumnsOracle(input, tableName);
    case 's3': return getColumnsS3(input, tableName);
    case 'azure_blob': return getColumnsAzure(input, tableName);
    case 'gcs': return getColumnsGcs(input, tableName);
    default: throw new Error(`Schema introspection for ${input.type} is not implemented yet.`);
  }
}
