import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { answerOf } from "./azureMcpAnswer";
import type { AzureMcpAnswer } from "./models/AzureMcpAnswer";
import type { AzureMcpStart } from "./models/AzureMcpStart";
import type { AzureMcpTool } from "./models/AzureMcpTool";

// A call waits this long for the server (the services' own timeouts are shorter).
const CALL_TIMEOUT_MS = 90_000;

const require = createRequire(import.meta.url);

// Microsoft's Azure MCP Server (user decision 2026-10-14), one process per run over stdio: read-only, the chosen
// namespaces, every tool by its own name (`--mode all`). It signs in through the `az` shim on PATH, which asks the
// runner for the vault's token. The tools are listed once at start; a call's answer is the server's JSON as text.
export class AzureMcpServer {
  private constructor(
    private readonly client: Client,
    private readonly list: AzureMcpTool[],
  ) {}

  static async start(options: AzureMcpStart): Promise<AzureMcpServer> {
    const namespaces = options.namespaces.flatMap((namespace) => ["--namespace", namespace]);
    const transport = new StdioClientTransport({ command: process.execPath, args: [wrapperPath(), "server", "start", "--read-only", "--mode", "all", ...namespaces], env: { ...getDefaultEnvironment(), ...options.env } });
    const client = new Client({ name: "powerloom-agent-runner", version: "1" });

    await client.connect(transport);

    const { tools } = await client.listTools();

    return new AzureMcpServer(client, tools.map(toolOf));
  }

  tools(): AzureMcpTool[] {
    return this.list;
  }

  async call(name: string, args: Record<string, unknown>): Promise<AzureMcpAnswer> {
    try {
      const result = await this.client.callTool({ name, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS });

      return answerOf(textOf(result.content), result.isError === true);
    } catch (error) {
      return { ok: false, message: `The Azure MCP server failed: ${(error as Error).message}`, denied: false };
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

// The npm wrapper (`@azure/mcp`) starts the platform binary; it runs on this process's node.
function wrapperPath(): string {
  return require.resolve("@azure/mcp/index.js");
}

function toolOf(tool: Tool): AzureMcpTool {
  const schema = tool.inputSchema as { properties?: AzureMcpTool["inputSchema"]["properties"]; required?: string[] };

  return { name: tool.name, description: tool.description ?? "", inputSchema: { properties: schema.properties ?? {}, required: schema.required ?? [] }, readOnly: tool.annotations?.readOnlyHint === true };
}

function textOf(content: unknown): string {
  const parts = Array.isArray(content) ? (content as { type: string; text?: string }[]) : [];

  return parts.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
}
