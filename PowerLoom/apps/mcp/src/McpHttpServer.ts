import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { azureTokenAnswer } from "@powerloom/agents";
import type { AzureUserLogin } from "@powerloom/azure";
import type { ChatSessions } from "./ChatSessions";
import type { ChatSession } from "./models/ChatSession";

const SESSION_HEADER = "mcp-session-id";
// The vault the session works in (decision MCPQ-005, 2026-10-23): the chat's .mcp.json sends it; the first vault otherwise.
const VAULT_HEADER = "x-powerloom-vault";

interface McpHttpOptions {
  token: string;
  sessions: ChatSessions;
  azureLogin: AzureUserLogin;
  /** The vaults' names, the first being the default. */
  vaults: () => Promise<string[]>;
}

// The MCP server's port (decision MCPQ-001, 2026-10-23): streamable HTTP at `/mcp`, loopback only through compose, a
// bearer token from .env for every call. `GET /azure/token` serves the `az` shim of the sessions' Azure MCP servers,
// `GET /health` compose's health check.
export class McpHttpServer {
  private readonly server: Server;

  constructor(private readonly options: McpHttpOptions) {
    this.server = createServer((request, response) => void this.handle(request, response));
  }

  listen(port: number): void {
    this.server.listen(port);
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://mcp");

    try {
      await this.route(request, response, url);
    } catch (error) {
      console.error(`${request.method} ${url.pathname} failed:`, error);
      answerIfOpen(response, 500, { error: "internal error" });
    }
  }

  private async route(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    if (request.method === "GET" && url.pathname === "/health") {
      answer(response, 200, { ok: true, sessions: this.options.sessions.count });

      return;
    }

    if (request.method === "GET" && url.pathname === "/azure/token") {
      const { status, body } = await azureTokenAnswer(this.options.azureLogin, url);

      answer(response, status, body);

      return;
    }

    if (url.pathname === "/mcp") {
      await this.mcp(request, response);

      return;
    }

    answer(response, 404, { error: "not found" });
  }

  private async mcp(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.authorized(request)) {
      answer(response, 401, { error: "a bearer token is required (MCP_TOKEN)" });

      return;
    }

    if (request.method === "POST") {
      await this.post(request, response);

      return;
    }

    const session = this.sessionOf(request);

    if (!session) {
      answer(response, 404, { error: "no such session; initialize first" });

      return;
    }

    await session.transport.handleRequest(request, response);
  }

  // A POST carries a session's message, or the initialize request that opens one.
  private async post(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readBody(request);
    const session = this.sessionOf(request);

    if (session) {
      await session.transport.handleRequest(request, response, body);

      return;
    }

    if (!isInitializeRequest(body)) {
      answer(response, 400, { error: "no session; send an initialize request first" });

      return;
    }

    const vault = await this.vaultOf(request);

    if (!vault) {
      answer(response, 400, { error: `unknown vault in ${VAULT_HEADER}` });

      return;
    }

    const opened = await this.options.sessions.open(vault, clientNameOf(body));

    await opened.transport.handleRequest(request, response, body);
  }

  private authorized(request: IncomingMessage): boolean {
    return request.headers.authorization === `Bearer ${this.options.token}`;
  }

  private sessionOf(request: IncomingMessage): ChatSession | undefined {
    const id = request.headers[SESSION_HEADER];

    return typeof id === "string" ? this.options.sessions.get(id) : undefined;
  }

  private async vaultOf(request: IncomingMessage): Promise<string | null> {
    const wanted = request.headers[VAULT_HEADER];
    const vaults = await this.options.vaults();

    if (typeof wanted !== "string" || wanted.length === 0) {
      return vaults[0] ?? null;
    }

    return vaults.includes(wanted) ? wanted : null;
  }
}

function clientNameOf(body: unknown): string {
  const name = (body as { params?: { clientInfo?: { name?: unknown } } }).params?.clientInfo?.name;

  return typeof name === "string" && name.length > 0 ? name : "unknown";
}

// The request's JSON body; null when it isn't JSON.
async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function answer(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function answerIfOpen(response: ServerResponse, status: number, body: object): void {
  if (!response.headersSent) {
    answer(response, status, body);
  }
}
