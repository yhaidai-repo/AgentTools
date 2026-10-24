const DEFAULT_URL = "http://mcp:3110";
const TIMEOUT_MS = 3_000;

// Whether PowerLoom's MCP server (the desktop chats' way in) answers its health check, asked over the compose network
// like Prometheus; false when it doesn't answer.
export async function mcpAnswers(): Promise<boolean> {
  try {
    const response = await fetch(`${(process.env.MCP_INTERNAL_URL ?? DEFAULT_URL).replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });

    return response.ok;
  } catch {
    return false;
  }
}
