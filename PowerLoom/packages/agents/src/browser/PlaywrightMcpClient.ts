import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ToolImage } from "@agenttools/runtime";
import type { McpEndpoint } from "@powerloom/devhub";
import type { McpCallResult } from "./models/McpCallResult";

// A call waits this long for the MCP (its own action and navigation timeouts are shorter).
const CALL_TIMEOUT_MS = 120_000;

// The open case's Playwright MCP, reached through DevHub's proxy with the vault's token. One session per case: the
// MCP keeps the browser, DevHub keeps the session id for its own calls (typing secrets, closing gracefully).
export class PlaywrightMcpClient {
  private constructor(private readonly client: Client) {}

  static async connect(endpoint: McpEndpoint): Promise<PlaywrightMcpClient> {
    const transport = new StreamableHTTPClientTransport(new URL(endpoint.url), { requestInit: { headers: endpoint.headers } });
    const client = new Client({ name: "powerloom-agent-runner", version: "1" });

    await client.connect(transport);

    return new PlaywrightMcpClient(client);
  }

  async call(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    try {
      const result = await this.client.callTool({ name, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS });
      const content = Array.isArray(result.content) ? (result.content as ContentPart[]) : [];

      return { text: textOf(content), images: imagesOf(content), isError: result.isError === true };
    } catch (error) {
      return { text: `The browser tool failed: ${(error as Error).message}`, images: [], isError: true };
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

type ContentPart = { type: string; text?: string; data?: string; mimeType?: string };

function textOf(content: ContentPart[]): string {
  return content.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
}

function imagesOf(content: ContentPart[]): ToolImage[] {
  return content.filter((part) => part.type === "image" && part.data).map((part) => ({ data: part.data!, mimeType: part.mimeType ?? "image/png" }));
}
