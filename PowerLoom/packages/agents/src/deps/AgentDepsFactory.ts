import { AdoClient } from "@powerloom/ado";
import { AzureMcpServer, CosmosConnectionStrings, ServiceBusPeeker, type AzureMcpStart, type AzureUserLogin } from "@powerloom/azure";
import { isAdoActive, isGitHubActive, isGoogleDriveReady, readAdoSettings, readAzureUserAccount, readDevHubSettings, readGitHubSettings, readGoogleDriveSettings, readReadAzureSettings, readReadSqlSettings, vaultBacklogRoot } from "@powerloom/core";
import { ConfluenceClient } from "@powerloom/confluence";
import type { PowerLoomDb } from "@powerloom/db";
import { DevHubClient } from "@powerloom/devhub";
import { MongoReader } from "@powerloom/mongo";
import { VaultCaptureCli } from "@powerloom/notes";
import { SqlReader } from "@powerloom/sql";
import { VaultWriter } from "@powerloom/vault";
import { PostgresAgentConfigStore, type AgentDefinition, type AgentsGlobal } from "@agenttools/config";
import { RepoCache, type RuntimeRegistry } from "@agenttools/runtime";
import { PostgresUsageStore, PriceBook } from "@agenttools/usage";
import type { Pool } from "pg";
import { AccessRequests } from "../AccessRequests";
import { AZURE_ACCESS_NAMESPACES, COSMOS_NAMESPACE } from "../azure/azureTools";
import { DataAccessLog } from "../DataAccessLog";
import { DocUsageLog } from "../DocUsageLog";
import { GitHubApi } from "../github/GitHubApi";
import { GoogleDriveClient } from "../googleDrive/GoogleDriveClient";
import type { AgentDeps } from "../models/AgentDeps";
import { ProviderConnections } from "../providerConnections";
import { SharedAzureServers } from "./SharedAzureServers";
import { loadCaptureRules } from "../vaultCapture";
import { repoGitAuth } from "./env";
import type { DepsEnv } from "./models/DepsEnv";

const REPO_REFRESH_MINUTES = 30;

type SharedDeps = Omit<AgentDeps, "repoCache" | "docsRoot" | "vaultRoot" | "docsVault" | "docsVaultName" | "listRegister" | "docUsageLog" | "sql" | "github" | "googleDrive" | "azure" | "devHub" | "ado">;

// Builds what a run or a chat session needs for one vault (the runner's deps, shared with the MCP server since the
// powerloom-mcp design, 2026-10-23): the vault's docs and backlog, its repo cache, and every integration the vault has
// switched on, read fresh per call so a switch flipped in Settings counts from the next run.
export class AgentDepsFactory {
  readonly config: PostgresAgentConfigStore;
  readonly usageStore: PostgresUsageStore;
  private readonly shared: SharedDeps;
  private readonly sqlReader = new SqlReader();
  private readonly mongoReader = new MongoReader();
  // One cache per vault (it remembers when each repo was fetched).
  private readonly repoCaches = new Map<string, RepoCache>();
  // Each vault's git sign-in as its last run read it; its cache reads it on every git command.
  private readonly repoAuth = new Map<string, string[]>();
  // The Azure MCP server per vault when the host serves many short sessions (the MCP server); null: one per run.
  private readonly sharedAzure: SharedAzureServers<AzureMcpServer> | null;

  private constructor(
    private readonly db: PowerLoomDb,
    pool: Pool,
    private readonly env: DepsEnv,
    readonly azureLogin: AzureUserLogin,
    runtimes: RuntimeRegistry,
    captureRules: AgentDeps["captureRules"],
    shareAzureServers: boolean,
  ) {
    this.sharedAzure = shareAzureServers ? new SharedAzureServers((options) => AzureMcpServer.start(options)) : null;
    this.config = new PostgresAgentConfigStore(pool);
    this.usageStore = new PostgresUsageStore(pool);
    this.shared = {
      db,
      config: this.config,
      runtimes,
      connections: ProviderConnections.forRunner(db, () => runtimes.providers()),
      usageStore: this.usageStore,
      prices: new PriceBook(),
      docsExclude: env.docsExclude,
      skillFolders: env.skillFolders,
      repoCacheRoot: env.repoCacheRoot,
      captureRules,
      vaults: { root: env.vaultsRoot, writer: (vault: string) => docsVaultOf(new VaultWriter(`${env.vaultsRoot}/${vault}`)) },
      accessLog: new DataAccessLog(db),
      outside: { log: new DataAccessLog(db), requests: new AccessRequests(db) },
      confluence: ConfluenceClient.fromEnv(),
      confluenceSite: env.confluenceSite,
      powerloomUrl: env.powerloomUrl,
    };
  }

  static async create(db: PowerLoomDb, pool: Pool, env: DepsEnv, hosts: { azureLogin: AzureUserLogin; runtimes: RuntimeRegistry; shareAzureServers?: boolean }): Promise<AgentDepsFactory> {
    const captureRules = await loadCaptureRules(env.captureHome);

    if (!captureRules) {
      console.error("VAULT_CAPTURE_HOME is not set: agents get no vault_capture tool");
    }

    return new AgentDepsFactory(db, pool, env, hosts.azureLogin, hosts.runtimes, captureRules, hosts.shareAzureServers === true);
  }

  /** The usage and config schemas, and every agent the code defines (a new one is added, saved values are kept). */
  async ensureStores(agents: AgentDefinition[], global: AgentsGlobal): Promise<void> {
    await this.usageStore.ensureSchema();
    await this.config.ensureSchema();
    await this.config.ensureDefaults(agents, global);
  }

  // The run reads docs from its vault, writes drafts, merges and the usage log into it, and reads the PBI note from the
  // vault's backlog. VaultWriter keeps every path inside the vault; the tech-writer's tools refuse draft/ and root files.
  async forVault(vault: string): Promise<AgentDeps> {
    const root = `${this.env.vaultsRoot}/${vault}`;

    return {
      ...this.shared,
      repoCache: await this.repoCacheOf(vault),
      docsRoot: root,
      vaultRoot: vaultBacklogRoot(this.env.backlogMount, vault),
      docsVault: docsVaultOf(new VaultWriter(root)),
      docsVaultName: vault,
      listRegister: async (project, kind) => (await VaultCaptureCli.forVault(vault, "the tech-writer lists a register")).listRegister(project, kind),
      docUsageLog: new DocUsageLog(`${root}/.usage/usage.jsonl`),
      sql: await this.sqlAccessOf(vault),
      github: await this.gitHubAccessOf(vault),
      googleDrive: await this.googleDriveAccessOf(vault),
      azure: await this.azureAccessOf(vault),
      devHub: await this.devHubAccessOf(vault),
      ado: await this.adoAccessOf(vault),
    };
  }

  // The deps' Azure MCP server process ends with the run or session; a close that fails is logged, the outcome stands.
  async closeAzure(azure: AgentDeps["azure"]): Promise<void> {
    if (this.sharedAzure) {
      return;
    }

    try {
      await azure?.server?.close();
    } catch (error) {
      console.error("the Azure MCP server did not close:", error);
    }
  }

  // The Azure MCP server runs for the run with the vault's sign-in: its `az` shim asks this host for tokens
  // (POWERLOOM_RUNNER_URL with this start's secret, the vault), the tenant is the signed-in account's. The Mongo reads take the same sign-in's
  // tokens; the Service Bus peeks use each namespace's own connection string from Settings. Nobody signed in = every
  // call answers `denied`, which asks the user to sign in.
  private async azureAccessOf(vault: string): Promise<AgentDeps["azure"]> {
    const settings = await readReadAzureSettings(this.db, vault);
    const namespaces = [...(settings.enabledKinds.azureAccess ? AZURE_ACCESS_NAMESPACES : []), ...(settings.enabledKinds.cosmos ? [COSMOS_NAMESPACE] : [])];
    const mongoOn = settings.enabledKinds.mongo === true;
    const serviceBusOn = settings.enabledKinds.serviceBus === true;

    if (namespaces.length === 0 && !mongoOn && !serviceBusOn) {
      return null;
    }

    const account = await readAzureUserAccount(this.db, vault);
    const env = { POWERLOOM_RUNNER_URL: this.env.azureTokenUrl, POWERLOOM_AZURE_TOKEN_SECRET: this.env.azureTokenSecret, POWERLOOM_AZURE_VAULT: vault, AZURE_TOKEN_CREDENTIALS: "AzureCliCredential", AZURE_TENANT_ID: account?.tenantId ?? "", AZURE_SUBSCRIPTION_ID: settings.subscription };
    const token = (resource: string) => this.azureLogin.token(vault, resource, account?.tenantId ?? null);

    return {
      settings,
      server: namespaces.length > 0 ? await this.azureServerOf(vault, { namespaces, env: withoutEmpty(env) }) : null,
      serviceBus: serviceBusOn ? { peeker: new ServiceBusPeeker() } : null,
      mongo: mongoOn ? { reader: this.mongoReader, connectionStrings: new CosmosConnectionStrings(token, settings.subscription) } : null,
    };
  }

  // One process per run (the runner), or the vault's shared one (the MCP server, whose sessions come and go).
  private azureServerOf(vault: string, options: AzureMcpStart): Promise<AzureMcpServer> {
    return this.sharedAzure ? this.sharedAzure.of(vault, options) : AzureMcpServer.start(options);
  }

  /** Starts each vault's shared Azure server now, in the background, so the first chat doesn't wait for it; a vault whose start fails is logged. */
  warmUpAzure(vaults: string[]): void {
    for (const vault of vaults) {
      void this.azureAccessOf(vault).catch((error) => console.error(`the Azure MCP server of ${vault} did not start:`, error));
    }
  }

  /** The shared Azure servers end with their host. */
  async closeSharedAzure(): Promise<void> {
    await this.sharedAzure?.closeAll();
  }

  // Without a token DevHub refuses every call, so the tools stay away until the vault has one.
  private async devHubAccessOf(vault: string): Promise<AgentDeps["devHub"]> {
    const settings = await readDevHubSettings(this.db, vault);

    return settings.enabled && settings.token ? { client: new DevHubClient(settings.url, settings.token), url: settings.url } : null;
  }

  // The vault's Azure DevOps, read only.
  private async adoAccessOf(vault: string): Promise<AgentDeps["ado"]> {
    const settings = await readAdoSettings(this.db, vault);

    return isAdoActive(settings) ? { client: new AdoClient({ orgUrl: settings.orgUrl, project: settings.project, team: settings.team, pat: settings.pat }), orgUrl: settings.orgUrl } : null;
  }

  // The vault's GitHub token for the GitHub tools, read fresh per run like the clones' sign-in.
  private async gitHubAccessOf(vault: string): Promise<AgentDeps["github"]> {
    const settings = await readGitHubSettings(this.db, vault);

    return isGitHubActive(settings) ? { api: new GitHubApi(settings.token), login: settings.login } : null;
  }

  // Read fresh per run: a folder added or a new sign-in in Settings counts from the next run.
  private async googleDriveAccessOf(vault: string): Promise<AgentDeps["googleDrive"]> {
    const settings = await readGoogleDriveSettings(this.db, vault);

    return isGoogleDriveReady(settings) ? { reader: new GoogleDriveClient(settings), folders: settings.folders } : null;
  }

  private async sqlAccessOf(vault: string): Promise<AgentDeps["sql"]> {
    const settings = await readReadSqlSettings(this.db, vault);
    const connections = settings.connections.filter((connection) => connection.enabled);

    return settings.enabled && connections.length > 0 ? { reader: this.sqlReader, connections } : null;
  }

  // Cloning with the vault's ADO and GitHub tokens, read again for every run so a token saved in Settings counts from
  // the next one; the vault's local repos are plain paths under the repos mount and need no token.
  private async repoCacheOf(vault: string): Promise<RepoCache> {
    this.repoAuth.set(vault, await this.repoGitAuthOf(vault));

    const cached = this.repoCaches.get(vault);

    if (cached) {
      return cached;
    }

    const cache = new RepoCache({ root: `${this.env.repoCacheRoot}/${vault}`, gitAuth: () => this.repoAuth.get(vault) ?? [], refreshMinutes: REPO_REFRESH_MINUTES });

    this.repoCaches.set(vault, cache);

    return cache;
  }

  private async repoGitAuthOf(vault: string): Promise<string[]> {
    const github = await readGitHubSettings(this.db, vault);

    return repoGitAuth((await readAdoSettings(this.db, vault))?.pat ?? "", github.enabled ? github.token : "");
  }
}

function docsVaultOf(writer: VaultWriter): NonNullable<AgentDeps["docsVault"]> {
  return {
    readNote: (path) => writer.readText(path),
    writeNote: async (path, content) => {
      await writer.writeText(path, content);
    },
    removeFile: (path) => writer.remove(path),
  };
}

function withoutEmpty(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value.length > 0));
}
