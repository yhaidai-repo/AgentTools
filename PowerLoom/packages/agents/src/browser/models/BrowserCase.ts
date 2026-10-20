import type { PlaywrightMcpClient } from "../PlaywrightMcpClient";

// The run's open browser case, if any: its name and the MCP session that drives it.
export interface BrowserCase {
  name: string | null;
  client: Pick<PlaywrightMcpClient, "call" | "close"> | null;
}
