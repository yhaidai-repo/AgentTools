import type { AdoaDb } from "@adoa/db";
import type { AgentConfigStore } from "@agenttools/config";
import type { RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import type { PriceBook, UsageStore } from "@agenttools/usage";
import type { CaptureRules } from "./CaptureRules";
import type { DocsVault } from "./DocsVault";
import type { RegisterEntry } from "./RegisterEntry";

export interface AgentDeps {
  db: AdoaDb;
  config: AgentConfigStore;
  runtimes: RuntimeRegistry;
  usageStore: UsageStore;
  prices: PriceBook;
  /** Read-only docs vault root. */
  docsRoot: string;
  /** Folders inside the docs root hidden from agents. */
  docsExclude: string[];
  /** Rendered Vault (backlog) root: agents read the PBI note from it. */
  vaultRoot: string;
  /** Folders searched for skills, first match wins. */
  skillFolders: string[];
  repoCache: RepoCache;
  /** VaultCapture rules; null when the module is not available (then agents get no vault_capture tool). */
  captureRules: CaptureRules | null;
  repoCacheRoot: string;
  /** Writable docs vault for the tech-writer; null where adoa may not write it. */
  docsVault: DocsVault | null;
  /** A project's register records (VaultCapture `register`); null where the module isn't available. */
  listRegister: ((project: string, kind: "questions" | "issues") => Promise<RegisterEntry[]>) | null;
}
