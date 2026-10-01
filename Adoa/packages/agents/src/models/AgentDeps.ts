import type { AdoaDb } from "@adoa/db";
import type { AgentRuntime } from "@agenttools/runtime";
import type { PriceBook, UsageStore } from "@agenttools/usage";

export interface AgentDeps {
  db: AdoaDb;
  runtime: AgentRuntime;
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
}
