import type { AdoAccess } from "./AdoAccess";
import type { ConfluenceClient } from "@powerloom/confluence";
import type { PowerLoomDb } from "@powerloom/db";
import type { AgentConfigStore } from "@agenttools/config";
import type { RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import type { PriceBook, UsageStore } from "@agenttools/usage";
import type { DataAccessLog } from "../DataAccessLog";
import type { OutsideAccessServices } from "./OutsideAccessServices";
import type { DocUsageLog } from "../DocUsageLog";
import type { CaptureRules } from "./CaptureRules";
import type { DocsVault } from "./DocsVault";
import type { RegisterEntry } from "./RegisterEntry";
import type { AzureAccess } from "./AzureAccess";
import type { DevHubAccess } from "./DevHubAccess";
import type { ProviderConnections } from "../providerConnections";
import type { SqlAccess } from "./SqlAccess";
import type { VaultsAccess } from "./VaultsAccess";
import type { GitHubAccess } from "../github/models/GitHubAccess";
import type { GoogleDriveAccess } from "../googleDrive/models/GoogleDriveAccess";
import type { RunWorktreeSlot } from "../sandbox/models/RunWorktreeSlot";
import type { SandboxAccess } from "../sandbox/models/SandboxAccess";
import type { WebSearchAccess } from "../webSearch/models/WebSearchAccess";

export interface AgentDeps {
  db: PowerLoomDb;
  config: AgentConfigStore;
  runtimes: RuntimeRegistry;
  /** Settings → AI providers: whether an agent's provider is connected; sets the run's login before it starts. */
  connections: ProviderConnections;
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
  /** The trusted Confluence site (CONFLUENCE_SITE); required for authenticated page access and search. */
  confluenceSite: string | null;
  /** Every tool call goes here (user decision 2026-10-13: traceable). */
  accessLog: DataAccessLog;
  /** The outside-read tools' wrapper: the same log, plus a human task for a denied call. */
  outside: OutsideAccessServices;
  /** The run's vault's Read SQL connections for agents with the integration on; null while the vault's Read SQL is off. */
  sql: SqlAccess | null;
  /** The run's vault's GitHub API with its token (GitHub (read) and (write)); null while its GitHub isn't connected. */
  github: GitHubAccess | null;
  /** The run's vault's Google Drive (its sign-in and chosen folders); null while it is off, signed out or has no folder. */
  googleDrive: GoogleDriveAccess | null;
  /** The run's vault's Read Azure (switches per kind, resources, the readers); null where no kind is on. */
  azure: AzureAccess | null;
  /** PowerLoom's API (POWERLOOM_URL): the one place an agent's commit may write through, e.g. a bug it found. */
  powerloomUrl: string;
  /** The run's vault's DevHub (DevHub on the host) for agents with the integration on; null while the vault's DevHub is off. */
  devHub: DevHubAccess | null;
  /** The host's sandbox service (SANDBOX_URL, SANDBOX_TOKEN) for agents with the integration on; null where it isn't set. */
  sandbox: SandboxAccess | null;
  /** The run's worktree, set by the runner when the run has a workspace; the sandbox copies that repo from it and sandbox_sync recopies it. */
  runWorktree?: RunWorktreeSlot;
  /** PowerLoom's own web search (search_web) while Settings → Data access → Web search is on; null otherwise. */
  webSearch: WebSearchAccess | null;
  /** The vault's Azure DevOps while its integration is on (the ADO tools). */
  ado: AdoAccess | null;
  /** The docs vault's usage log (VaultUsage) agents' doc reads go to; null where the vault isn't writable. */
  docUsageLog: DocUsageLog | null;
  /** The runner's Stop for this run (the run page's Stop); aborted, the agent ends at once and the run keeps what it has. */
  stop?: AbortSignal;
}
