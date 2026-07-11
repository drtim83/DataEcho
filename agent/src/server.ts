import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sql from "mssql";

// We keep a simple in-memory pool for the SQL Server connection
let pool: sql.ConnectionPool | null = null;

export const server = new McpServer({
  name: "dataecho-mssql-agent",
  version: "1.0.0",
});

// Helper to get or create connection pool
async function getPool(connectionString: string) {
  if (pool) return pool;
  try {
    pool = await sql.connect(connectionString);
    return pool;
  } catch (err) {
    throw new Error(`Failed to connect to database: ${err}`);
  }
}

// 1. Tool: test_connection
server.tool(
  "test_connection",
  "Test if the SQL Server database is reachable with the provided credentials",
  {
    connectionString: z.string().describe("SQL Server connection string (e.g., Server=10.0.1.50;Database=HR;User Id=sa;Password=secret;Encrypt=true)"),
  },
  async ({ connectionString }) => {
    try {
      const p = await getPool(connectionString);
      const result = await p.request().query("SELECT @@VERSION as version");
      return {
        content: [{ type: "text", text: `Connection successful! Server version: ${result.recordset[0].version}` }],
      };
    } catch (err: any) {
       return {
        content: [{ type: "text", text: `Connection failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// 2. Tool: list_tables
server.tool(
  "list_tables",
  "List all user tables in the database",
  {
    connectionString: z.string(),
  },
  async ({ connectionString }) => {
    try {
      const p = await getPool(connectionString);
      const result = await p.request().query(`
        SELECT TABLE_SCHEMA, TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `);
      return {
        content: [{ type: "text", text: JSON.stringify(result.recordset, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Failed to list tables: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// 3. Tool: preview_schema
server.tool(
  "preview_schema",
  "Get column names and data types for a specific table",
  {
    connectionString: z.string(),
    tableName: z.string().describe("Name of the table (e.g., dbo.Employees)"),
  },
  async ({ connectionString, tableName }) => {
    try {
      // Basic split for schema.table (assumes dbo if no schema provided)
      const parts = tableName.split('.');
      const schema = parts.length > 1 ? parts[0] : 'dbo';
      const name = parts.length > 1 ? parts[1] : parts[0];

      const p = await getPool(connectionString);
      const result = await p.request()
        .input('schema', sql.NVarChar, schema)
        .input('name', sql.NVarChar, name)
        .query(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @name
          ORDER BY ORDINAL_POSITION
        `);
      return {
        content: [{ type: "text", text: JSON.stringify(result.recordset, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Failed to get schema: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// 4. Tool: extract_data
server.tool(
  "extract_data",
  "Extract up to N rows from a table",
  {
    connectionString: z.string(),
    tableName: z.string(),
    limit: z.number().default(100),
  },
  async ({ connectionString, tableName, limit }) => {
    try {
      // In a real production app, tableName must be strictly sanitized to prevent SQL injection.
      // For this prototype, we're assuming trusted input from our own cloud app.
      const p = await getPool(connectionString);
      const result = await p.request().query(`SELECT TOP ${limit} * FROM ${tableName}`);
      return {
        content: [{ type: "text", text: JSON.stringify(result.recordset, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Failed to extract data: ${err.message}` }],
        isError: true,
      };
    }
  }
);

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DataEcho MCP Agent running on stdio");
}
