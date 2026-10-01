import type { AdoaDb } from "@adoa/db";
import type { AgentConfigStore } from "@agenttools/config";
import type { RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import type { PriceBook, UsageStore } from "@agenttools/usage";

export interface AgentDeps {
  db: AdoaDb;
  config: AgentConfigStore;
  runtimes: RuntimeRegistry;
  usageStore: UsageStore;
  prices: PriceBook;
  /** Read-only docs vault root. */
  docsRoot: string;
  /** Folders inside the docs root hidden from agents (e.g. the rendered backlog). */
  docsExclude: string[];
  /** Read-only rendered Vault (backlog) root. */
  vaultRoot: string;
  /** Folders searched for skills, first match wins. */
  skillFolders: string[];
  repoCache: RepoCache;
  repoCacheRoot: string;
  /** Asks the worker (the only Vault writer) to render a PBI's notes. */
  enqueueRender: (adoId: number) => Promise<void>;
}
