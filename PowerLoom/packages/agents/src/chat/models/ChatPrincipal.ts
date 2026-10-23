import { CHAT_STAGE } from "@powerloom/core";

// The agent definition whose Config grants a chat its reading tools (design powerloom-mcp, 2026-10-23): the same name
// as the stage of its runs.
export const CHAT_AGENT_ID = CHAT_STAGE;

// Who is calling through the MCP server: one MCP session, logged as one run of the `chat` agent.
export interface ChatPrincipal {
  vault: string;
  /** The MCP client's name (its initialize request), e.g. claude-code. */
  client: string;
  runId: number;
}
