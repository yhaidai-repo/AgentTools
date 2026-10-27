import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CHAT_AGENT_ID, chatOwner, chatSessionTools, closeOwnedBrowser, recordToolOffer, stopOwnedStack, type AgentDeps } from "@powerloom/agents";
import type { CommandContext } from "@powerloom/core";
import type { ChatHost } from "./models/ChatHost";
import type { ChatSession } from "./models/ChatSession";
import { registerTools } from "./registerTools";
import { closeBrowserOwner, openBrowserOwner, renewBrowserOwners } from "./chatBrowserOwners";

const SERVER_NAME = "powerloom";
const SERVER_VERSION = "1.0.0";

// The open MCP sessions. A session is not a run (user decision 2026-10-24: nothing of it in agent_run); it is built
// for one vault with the chat agent's grants at that moment, its tools are the agents' readers and every command, and
// its calls go to the data access log and the usage log under its id.
export class ChatSessions {
  private readonly sessions = new Map<string, ChatSession>();
  private readonly allocated = new Map<string, ChatSession>();
  private readonly disposed = new WeakMap<ChatSession, Promise<void>>();
  private readonly closing = new Set<Promise<void>>();
  private readonly opening = new Set<Promise<ChatSession>>();
  private stopping = false;

  constructor(private readonly host: ChatHost) {}

  get count(): number {
    return this.sessions.size;
  }

  get(id: string): ChatSession | undefined {
    const session = this.sessions.get(id);

    if (session) {
      session.lastUsedAt = Date.now();
    }

    return session;
  }

  /** A session for the initialize request: registered under its id once the transport confirmed it. */
  open(vault: string, client: string): Promise<ChatSession> {
    if (this.stopping) return Promise.reject(new Error("MCP sessions are shutting down"));
    const opening = this.allocate(vault, client);
    this.opening.add(opening);
    void opening.then(() => this.opening.delete(opening), () => this.opening.delete(opening));
    return opening;
  }

  private async allocate(vault: string, client: string): Promise<ChatSession> {
    const id = randomUUID();
    const deps = await this.host.deps.forVault(vault);
    if (this.stopping) {
      await this.host.deps.closeAzure(deps.azure);
      throw new Error("MCP sessions are shutting down");
    }
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => id,
      onsessioninitialized: () => {
        if (!this.allocated.has(id)) throw new Error("MCP session is closed");
        this.sessions.set(id, session);
      },
    });
    const session: ChatSession = { id, vault, client, deps, server, transport, lastUsedAt: Date.now() };
    this.allocated.set(id, session);

    try {
      await openBrowserOwner(this.host.db, chatOwner(id), vault);
      const tools = chatSessionTools(deps, await this.chatAgent(deps), { vault, client, sessionId: id }, this.commandContext(client));

      registerTools(server, tools.tools);
      await recordToolOffer(this.host.db, vault, CHAT_AGENT_ID, tools.offered);
      if (!this.allocated.has(id)) throw new Error("MCP session is closed");
      transport.onclose = () => void this.close(session);
      await server.connect(transport);
    } catch (error) {
      await this.close(session);
      throw error;
    }

    console.log(`session ${id} for ${client} on ${vault}`);

    return session;
  }

  async closeIdle(maxIdleMs: number): Promise<void> {
    const idle = [...this.allocated.values()].filter((session) => Date.now() - session.lastUsedAt > maxIdleMs);

    for (const session of idle) {
      await this.close(session);
    }
    await renewBrowserOwners(this.host.db, [...this.allocated.keys()].map(chatOwner));
  }

  async closeAll(): Promise<void> {
    this.stopping = true;
    await Promise.all([...this.allocated.values()].map((session) => this.close(session)));
    await Promise.allSettled([...this.opening]);
    await Promise.all([...this.closing]);
  }

  // The session's stack and browser on DevHub stop with it, the Azure server closes.
  close(session: ChatSession): Promise<void> {
    const existing = this.disposed.get(session);
    if (existing) return existing;
    this.sessions.delete(session.id);
    this.allocated.delete(session.id);
    // Defer callbacks until the idempotent promise is installed: transport.close invokes onclose too.
    const closing = Promise.resolve().then(async () => {
      const results = await Promise.allSettled([
        session.server.close(),
        stopDevHubOfSession(session),
        this.host.deps.closeAzure(session.deps.azure),
        closeBrowserOwner(this.host.db, chatOwner(session.id)),
      ]);
      for (const result of results) {
        if (result.status === "rejected") console.error(`session ${session.id}: closing failed:`, result.reason);
      }
      console.log(`session ${session.id} ended`);
    });
    this.disposed.set(session, closing);
    this.closing.add(closing);
    void closing.then(() => this.closing.delete(closing));
    return closing;
  }

  private async chatAgent(deps: AgentDeps) {
    const agent = await deps.config.get(CHAT_AGENT_ID);

    if (!agent) {
      throw new Error(`agent "${CHAT_AGENT_ID}" is not configured`);
    }

    return agent;
  }

  // The commands run as the chat (status_history actor `chat:<client>`), writing through PowerLoom like the web.
  private commandContext(client: string): CommandContext {
    return { db: this.host.db, actor: `chat:${client}`, powerloom: this.host.powerloom, skills: this.host.skills, backlogMount: this.host.backlogMount, agents: this.host.agents, usage: this.host.usage, hostFolders: this.host.hostFolders };
  }
}

async function stopDevHubOfSession(session: ChatSession): Promise<void> {
  if (!session.deps.devHub) {
    return;
  }

  logNote(await closeOwnedBrowser(session.deps.devHub.client, chatOwner(session.id)));
  logNote(await stopOwnedStack(session.deps.devHub.client, chatOwner(session.id)));
}

function logNote(note: string | null): void {
  if (note) {
    console.log(note);
  }
}
