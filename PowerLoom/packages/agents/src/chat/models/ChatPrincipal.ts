// The agent definition whose Config grants a chat its reading tools (design powerloom-mcp, 2026-10-23).
export const CHAT_AGENT_ID = "chat";

// Who is calling through the MCP server: one MCP session. Not a run (user decision 2026-10-24): nothing of it is
// stored but its tool calls in the data access log and its doc reads in the usage log, both under the session's id.
export interface ChatPrincipal {
  vault: string;
  /** The MCP client's name (its initialize request), e.g. claude-code. */
  client: string;
  /** The MCP session id. */
  sessionId: string;
}
