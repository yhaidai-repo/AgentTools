import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AgentDeps } from "@powerloom/agents";

// One MCP session: its id, its transport and server, and the vault's deps it was built with. Not a run (user decision
// 2026-10-24): it leaves no agent_run row.
export interface ChatSession {
  id: string;
  vault: string;
  client: string;
  deps: AgentDeps;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastUsedAt: number;
}
