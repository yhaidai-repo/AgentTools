import type { ConfluenceClient } from "@powerloom/confluence";
import type { PowerLoomDb } from "@powerloom/db";
import type { AgentConfigStore } from "@agenttools/config";
import type { RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import type { PriceBook, UsageStore } from "@agenttools/usage";
import type { DocUsageLog } from "../DocUsageLog";
import type { CaptureRules } from "./CaptureRules";
import type { DocsVault } from "./DocsVault";
import type { RegisterEntry } from "./RegisterEntry";
import type { SqlAccess } from "./SqlAccess";
import type { VaultsAccess } from "./VaultsAccess";

export interface AgentDeps {
  db: PowerLoomDb;
  config: AgentConfigStore;
  runtimes: RuntimeRegistry;
  usageStore: UsageStore;
  prices: PriceBook;
  /** The run's vault (the task's PBI's, or the task's own): its docs root. */
  docsRoot: string;
  /** Folders inside the docs root hidden from agents. */
  docsExclude: string[];
  /** The run's vault's rendered backlog: agents read the PBI note from it. */
  vaultRoot: string;
  /** Folders searched for skills, first match wins. */
  skillFolders: string[];
  repoCache: RepoCache;
  /** VaultCapture rules; null when the module is not available (then agents get no vault_capture tool). */
  captureRules: CaptureRules | null;
  repoCacheRoot: string;
  /** The run's vault, writable, for the tech-writer; null where PowerLoom may not write it. */
  docsVault: DocsVault | null;
  /** The run's vault's folder name: findings and the Vault page's note writes are about it. */
  docsVaultName: string;
  /** Every vault under the vaults root, writable; null where it isn't mounted. */
  vaults: VaultsAccess | null;
  /** A project's register records (VaultCapture `register`); null where the module isn't available. */
  listRegister: ((project: string, kind: "questions" | "issues") => Promise<RegisterEntry[]>) | null;
  /** Confluence account for agents with the integration on; null when CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN aren't set. */
  confluence: ConfluenceClient | null;
  /** The Confluence site agents search (CONFLUENCE_SITE); null = no search tool, page links still work. */
  confluenceSite: string | null;
  /** The run's vault's Read SQL connections for agents with the integration on; null while the vault's Read SQL is off. */
  sql: SqlAccess | null;
  /** The docs vault's usage log (VaultUsage) agents' doc reads go to; null where the vault isn't writable. */
  docUsageLog: DocUsageLog | null;
}
