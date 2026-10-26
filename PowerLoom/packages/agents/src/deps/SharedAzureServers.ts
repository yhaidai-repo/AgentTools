import type { AzureMcpStart } from "@powerloom/azure";
import type { SharedAzureEntry } from "./models/SharedAzureEntry";

interface Closable {
  close(): Promise<void>;
}

// One Azure MCP server per vault for a host that serves many short sessions (the MCP server), instead of one process
// per session: starting it takes about a minute, and a chat's `initialize` waited for it (2026-10-26: Claude Code gave
// up after its connect timeout). It starts once, in the background when the host starts, and is reused while the
// vault's start options (namespaces, the sign-in's tenant, the subscription) are the same; a changed sign-in or switch
// starts a new one and closes the old. A start that failed is forgotten, so the next caller tries again.
export class SharedAzureServers<TServer extends Closable> {
  private readonly entries = new Map<string, SharedAzureEntry<TServer>>();

  constructor(private readonly start: (options: AzureMcpStart) => Promise<TServer>) {}

  of(vault: string, options: AzureMcpStart): Promise<TServer> {
    const key = JSON.stringify(options);
    const current = this.entries.get(vault);

    if (current?.key === key) {
      return current.server;
    }

    const entry = this.begin(vault, key, options);

    this.entries.set(vault, entry);

    if (current) {
      void this.closeQuietly(current.server);
    }

    return entry.server;
  }

  async closeAll(): Promise<void> {
    const servers = [...this.entries.values()].map((entry) => entry.server);

    this.entries.clear();
    await Promise.all(servers.map((server) => this.closeQuietly(server)));
  }

  private begin(vault: string, key: string, options: AzureMcpStart): SharedAzureEntry<TServer> {
    const server = this.start(options);

    server.catch(() => {
      if (this.entries.get(vault)?.server === server) {
        this.entries.delete(vault);
      }
    });

    return { key, server };
  }

  // A server that never started has nothing to close; one that fails to close is logged, the replacement stands.
  private async closeQuietly(server: Promise<TServer>): Promise<void> {
    try {
      await (await server).close();
    } catch (error) {
      console.error("a shared Azure MCP server did not close:", error);
    }
  }
}
