import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AgentDeps, ChatRun } from "@powerloom/agents";

// One MCP session: its transport and server, the vault's deps it was built with, and the run that records it.
export interface ChatSession {
  vault: string;
  client: string;
  run: ChatRun;
  deps: AgentDeps;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastUsedAt: number;
}
