# DataEcho MCP Agent

The DataEcho MCP (Model Context Protocol) Agent is a lightweight, secure on-premise connector. It enables the DataEcho cloud application to securely query your internal databases (like SQL Server) without requiring inbound firewall rules or VPNs.

## Architecture

This agent acts as an MCP server. It initiates an outbound connection and exposes "tools" (like `test_connection`, `list_tables`, `preview_schema`, `extract_data`) to the DataEcho cloud platform. The cloud platform calls these tools, and the agent executes the appropriate SQL commands locally and returns the results.

## Prerequisites

- Node.js (v18 or higher)
- Access to the target database (e.g., MS SQL Server)

## Installation

1. Clone or copy this directory to a machine inside your corporate network that has access to the target database.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the agent:
   ```bash
   npm run build
   ```

## Usage

You can run the agent directly using Node:

```bash
npm start
```

For development, you can use `tsx` to run the TypeScript source directly:

```bash
npm run dev
```

The agent runs over standard input/output (stdio) by default, making it easy to integrate with MCP clients.

## Supported Databases

- Microsoft SQL Server (`mssql` driver)
- *Additional drivers can be added to `src/server.ts`*
