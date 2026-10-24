import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CHAT_AGENT_ID, chatOwner, chatTools, closeOwnedBrowser, stopOwnedStack, type AgentDeps } from "@powerloom/agents";
import type { CommandContext } from "@powerloom/core";
import type { ChatHost } from "./models/ChatHost";
import type { ChatSession } from "./models/ChatSession";
import { registerTools } from "./registerTools";

const SERVER_NAME = "powerloom";
const SERVER_VERSION = "1.0.0";

// The open MCP sessions. A session is not a run (user decision 2026-10-24: nothing of it in agent_run); it is built
// for one vault with the chat agent's grants at that moment, its tools are the agents' readers and every command, and
// its calls go to the data access log and the usage log under its id.
export class ChatSessions {
  private readonly sessions = new Map<string, ChatSession>();

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
  async open(vault: string, client: string): Promise<ChatSession> {
    const id = randomUUID();
    const deps = await this.host.deps.forVault(vault);
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => id,
      onsessioninitialized: () => {
        this.sessions.set(id, session);
      },
    });
    const session: ChatSession = { id, vault, client, deps, server, transport, lastUsedAt: Date.now() };

    try {
      registerTools(server, chatTools(deps, await this.chatAgent(deps), { vault, client, sessionId: id }, this.commandContext(client)));
      transport.onclose = () => void this.close(session);
      await server.connect(transport);
    } catch (error) {
      await this.host.deps.closeAzure(deps.azure);
      throw error;
    }

    console.log(`session ${id} for ${client} on ${vault}`);

    return session;
  }

  async closeIdle(maxIdleMs: number): Promise<void> {
    const idle = [...this.sessions.values()].filter((session) => Date.now() - session.lastUsedAt > maxIdleMs);

    for (const session of idle) {
      await session.transport.close();
    }
  }

  async closeAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.transport.onclose = undefined;
      await session.transport.close();
      await this.close(session);
    }
  }

  // The session's stack and browser on DevHub stop with it, the Azure server closes.
  private async close(session: ChatSession): Promise<void> {
    if (!this.sessions.delete(session.id)) {
      return;
    }

    try {
      await stopDevHubOfSession(session);
      await this.host.deps.closeAzure(session.deps.azure);
    } catch (error) {
      console.error(`session ${session.id}: closing failed:`, error);
    }

    console.log(`session ${session.id} ended`);
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
