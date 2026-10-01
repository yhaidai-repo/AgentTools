import type { AdoaDb } from "@adoa/db";
import type { AgentConfigStore } from "@agenttools/config";
import type { RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import type { PriceBook, UsageStore } from "@agenttools/usage";
import type { CaptureRules } from "./CaptureRules";

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
  /** Rendered Vault (backlog) root: agents read the PBI note from it. */
  vaultRoot: string;
  /** Folders searched for skills, first match wins. */
  skillFolders: string[];
  repoCache: RepoCache;
  /** VaultCapture rules; null when the module is not available (then agents get no vault_capture tool). */
  captureRules: CaptureRules | null;
  repoCacheRoot: string;
}
