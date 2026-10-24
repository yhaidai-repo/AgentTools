import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ToolDefinition } from "../../models/ToolDefinition";
import type { ToolResult } from "../../models/ToolResult";
import { codexToolNamer } from "./codexToolNames";

export class CodexToolServer {
  readonly token = randomBytes(32).toString("hex");
  private readonly listener: Server;
  private readonly connections = new Set<McpServer>();
  private address = "";
  private closed = false;

  private constructor(private readonly tools: ToolDefinition<any>[], private readonly signal: AbortSignal) {
    this.listener = createServer((request, response) => { void this.handle(request, response); });
  }

  static async start(tools: ToolDefinition<any>[], signal: AbortSignal): Promise<CodexToolServer> {
    const server = new CodexToolServer(tools, signal);

    await server.listen();

    return server;
  }

  get url(): string {
    return this.address;
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.allSettled([...this.connections].map((connection) => connection.close()));

    const closing = new Promise<void>((resolve) => this.listener.close(() => resolve()));

    this.listener.closeAllConnections();
    await closing;
  }

  private async listen(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.listener.once("error", reject);
      this.listener.listen(0, "127.0.0.1", () => { this.listener.removeListener("error", reject); resolve(); });
    });

    const address = this.listener.address();

    if (!address || typeof address === "string") {
      throw new Error("The Codex tool server has no TCP address.");
    }

    this.address = "http://127.0.0.1:" + address.port + "/mcp";
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.headers.authorization !== "Bearer " + this.token) {
      response.writeHead(401).end();

      return;
    }

    if (request.url !== "/mcp") {
      response.writeHead(404).end();

      return;
    }

    if (this.closed || this.signal.aborted) {
      response.writeHead(503).end();

      return;
    }

    if (request.method !== "POST") {
      response.writeHead(405).end();

      return;
    }

    await this.serve(request, response);
  }

  private async serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const server = this.createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      enableDnsRebindingProtection: true,
      allowedHosts: [new URL(this.url).host],
    });

    this.connections.add(server);
    response.once("close", () => { void server.close(); this.connections.delete(server); });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response);
    } catch {
      this.failResponse(response);
      await server.close();
      this.connections.delete(server);
    }
  }

  private failResponse(response: ServerResponse): void {
    if (!response.headersSent) {
      response.writeHead(500).end();
    }
  }

  private createMcpServer(): McpServer {
    const server = new McpServer({ name: "agent", version: "1.0.0" });

    for (const definition of this.tools) {
      this.register(server, definition);
    }

    return server;
  }

  private register(server: McpServer, definition: ToolDefinition<any>): void {
    const annotations = { readOnlyHint: definition.annotations?.readOnly ?? false, destructiveHint: definition.annotations?.destructive ?? false };

    server.registerTool(definition.name, { description: definition.description, inputSchema: definition.input, annotations },
      async (input: unknown) => this.call(definition, input));
  }

  private async call(definition: ToolDefinition<any>, input: unknown) {
    try {
      this.signal.throwIfAborted();

      return this.content(await definition.handler(input as never));
    } catch (error) {
      return this.content({ text: "Error: " + (error instanceof Error ? error.message : String(error)), isError: true });
    }
  }

  private content(result: ToolResult) {
    const text = codexToolNamer(this.tools)(result.text);
    const images = (result.images ?? []).map((image) => ({ type: "image" as const, data: image.data, mimeType: image.mimeType }));

    return { content: [{ type: "text" as const, text }, ...images], isError: result.isError ?? false };
  }
}
