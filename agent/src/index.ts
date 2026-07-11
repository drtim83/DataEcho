import { startServer } from "./server.js";

startServer().catch((error) => {
  console.error("Fatal error starting DataEcho MCP Agent:", error);
  process.exit(1);
});
