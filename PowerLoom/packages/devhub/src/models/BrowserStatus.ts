// GET /browser: the open case, if any, and when it closes by itself.
export interface BrowserStatus {
  open: boolean;
  owner: string | null;
  case: string | null;
  headless: boolean | null;
  startedAt: string | null;
  expiresAt: string | null;
  /** The agent has talked to the case's MCP through the proxy (DevHub can then type secrets and close gracefully). */
  mcpSessionKnown: boolean;
}
