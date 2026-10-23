import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CHAT_AGENT_ID, ChatRun, chatTools, closeRunBrowser, stopRunStack, type AgentDeps } from "@powerloom/agents";
import type { CommandContext } from "@powerloom/core";
import type { ChatHost } from "./models/ChatHost";
import type { ChatSession } from "./models/ChatSession";
import { registerTools } from "./registerTools";

const SERVER_NAME = "powerloom";
const SERVER_VERSION = "1.0.0";

type SessionOutcome = "success" | "aborted" | "failed";

// The open MCP sessions (decision MCPQ-002, 2026-10-23: one session = one run of the `chat` agent). A session is built
// for one vault with the chat agent's grants at that moment; its tools are the agents' readers and every command.
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

  /** A session for the initialize request: registered under its id once the transport assigned one. */
  async open(vault: string, client: string): Promise<ChatSession> {
    const deps = await this.host.deps.forVault(vault);
    const run = await ChatRun.begin(this.host.db, { vault, client });
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        this.sessions.set(id, session);
      },
    });
    const session: ChatSession = { vault, client, run, deps, server, transport, lastUsedAt: Date.now() };

    try {
      registerTools(server, chatTools(deps, await this.chatAgent(deps), { vault, client, runId: run.id }, this.commandContext(client)));
      transport.onclose = () => void this.close(session, "success");
      await server.connect(transport);
    } catch (error) {
      await this.abandon(session, error);
      throw error;
    }

    console.log(`session for ${client} on ${vault}: RUN-${run.id}`);

    return session;
  }

  // A session that couldn't be built leaves no run in progress and no Azure server behind.
  private async abandon(session: ChatSession, error: unknown): Promise<void> {
    await this.host.deps.closeAzure(session.deps.azure);
    await session.run.end("failed", error instanceof Error ? error.message : String(error));
  }

  async closeIdle(maxIdleMs: number): Promise<void> {
    const idle = [...this.sessions.values()].filter((session) => Date.now() - session.lastUsedAt > maxIdleMs);

    for (const session of idle) {
      await session.transport.close();
    }
  }

  async closeAll(outcome: SessionOutcome): Promise<void> {
    for (const session of this.sessions.values()) {
      session.transport.onclose = undefined;
      await session.transport.close();
      await this.close(session, outcome);
    }
  }

  // The chat's run ends with its session: its stack and browser on DevHub are stopped, the Azure server closed.
  private async close(session: ChatSession, outcome: SessionOutcome): Promise<void> {
    const id = session.transport.sessionId;

    if (id === undefined || !this.sessions.delete(id)) {
      return;
    }

    try {
      await stopDevHubOfRun(session.deps, session.run.id);
      await this.host.deps.closeAzure(session.deps.azure);
      await session.run.end(outcome);
    } catch (error) {
      console.error(`RUN-${session.run.id}: closing the session failed:`, error);
    }

    console.log(`session RUN-${session.run.id} ended (${outcome})`);
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
    return { db: this.host.db, actor: `chat:${client}`, powerloom: this.host.powerloom, skills: this.host.skills, backlogMount: this.host.backlogMount, agents: this.host.agents, usage: this.host.usage };
  }
}

async function stopDevHubOfRun(deps: AgentDeps, runId: number): Promise<void> {
  if (!deps.devHub) {
    return;
  }

  logNote(await closeRunBrowser(deps.devHub.client, runId));
  logNote(await stopRunStack(deps.devHub.client, runId));
}

function logNote(note: string | null): void {
  if (note) {
    console.log(note);
  }
}
