import type { ConfluenceClient } from "@adoa/confluence";
import type { AdoaDb } from "@adoa/db";
import type { AgentConfigStore } from "@agenttools/config";
import type { RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import type { PriceBook, UsageStore } from "@agenttools/usage";
import type { DocUsageLog } from "../DocUsageLog";
import type { CaptureRules } from "./CaptureRules";
import type { DocsVault } from "./DocsVault";
import type { RegisterEntry } from "./RegisterEntry";
import type { VaultsAccess } from "./VaultsAccess";

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
  /** The docs vault's folder name (DOCS_VAULT_NAME): findings and the Vault page's note writes are about it. */
  docsVaultName: string | null;
  /** Every vault under the vaults root, writable; null where it isn't mounted. */
  vaults: VaultsAccess | null;
  /** A project's register records (VaultCapture `register`); null where the module isn't available. */
  listRegister: ((project: string, kind: "questions" | "issues") => Promise<RegisterEntry[]>) | null;
  /** Confluence account for agents with the integration on; null when CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN aren't set. */
  confluence: ConfluenceClient | null;
  /** The Confluence site agents search (CONFLUENCE_SITE); null = no search tool, page links still work. */
  confluenceSite: string | null;
  /** The docs vault's usage log (VaultUsage) agents' doc reads go to; null where the vault isn't writable. */
  docUsageLog: DocUsageLog | null;
}
