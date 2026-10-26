import { FRAMEWORK_ID, isAdoActive, isGitHubActive, listVaultRepos, readGitHubCheckStatus, readAdoSettings, readCleanupSettings, readConfluenceStatus, readCurrentSprint, readImportSettings, readImportSourceActivity, readImportStatus, readAzureUserAccount, readDevHubSettings, readGitHubSettings, readGoogleDriveSettings, readPullRequestSettings, readReadAzureSettings, readReadSqlSettings, readSyncSettings, readVault, type AdoSettings, type ConfluenceStatus, type GitHubSettings, type GoogleDriveSettings, type ReadAzureSettings, type ReadSqlSettings, type RepoRow } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { NoVault } from "@/components/NoVault";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadAiProviders, loadChatApps, type ProviderStatus } from "@/lib/aiProviders";
import { spentToday } from "@/lib/budgetUsage";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { readPromptFile } from "@/lib/promptFiles";
import { loadPromptVersions } from "@/lib/promptVersions";
import { loadSprintChoices } from "@/lib/sprints";
import type { AdoIntegrationValues } from "@/models/AdoIntegrationValues";
import type { GitHubValues } from "@/models/GitHubValues";
import type { GoogleDriveValues } from "@/models/GoogleDriveValues";
import type { AzureResourceRow } from "@/models/AzureResourceRow";
import type { SettingsTabMark } from "@/models/SettingsTabMark";
import type { SqlConnectionRow } from "@/models/SqlConnectionRow";
import { AdoIntegrationForm } from "./AdoIntegrationForm";
import { ChatAppForm } from "./ChatAppForm";
import { ClaudeTokenForm } from "./ClaudeTokenForm";
import { CodexConnectForm } from "./CodexConnectForm";
import { CleanupSettingsForm } from "./CleanupSettingsForm";
import { DevHubForm } from "./DevHubForm";
import { GitHubForm } from "./GitHubForm";
import { GitHubPullRequestsForm } from "./GitHubPullRequestsForm";
import type { GitHubPullRequestsValues } from "@/models/GitHubPullRequestsValues";
import { GoogleDrivePanel } from "./GoogleDrivePanel";
import { FrameworkForm } from "./FrameworkForm";
import { GlobalAgentForm } from "./GlobalAgentForm";
import { ImportSettingsForm } from "./ImportSettingsForm";
import { ImportStatus } from "./ImportStatus";
import { PullRequestSettingsForm } from "./PullRequestSettingsForm";
import { ReadAzurePanel } from "./ReadAzurePanel";
import { ReadSqlPanel } from "./ReadSqlPanel";
import { RepositoriesPanel } from "./RepositoriesPanel";
import { SettingsForm } from "./SettingsForm";
import { SETTINGS_TABS, SettingsTabs, type SettingsTab } from "./SettingsTabs";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: string; show?: string; drive?: string }>;

// The settings of the vault picked at the top, one tab per area (user decision 2026-10-18); each card has its feature's
// switch in its head and its Save at its foot.
export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const db = getDb();
  const current = await currentVault();

  if (!current) {
    return <NoVault title="Settings" />;
  }

  const params = await searchParams;
  const tab = SETTINGS_TABS.find((choice) => choice.key === params.tab)?.key ?? "ado";
  const ado = await readAdoSettings(db, current);
  const repos = await listVaultRepos(db, current);
  const readSql = await readReadSqlSettings(db, current);
  const readAzure = await readReadAzureSettings(db, current);
  const devHub = await readDevHubSettings(db, current);
  const github = await readGitHubSettings(db, current);
  const providers = await loadAiProviders();
  const marks = await tabMarks(db, current, { adoActive: isAdoActive(ado), gitHubActive: isGitHubActive(github), repos, readSql, readAzure, devHubOn: devHub.enabled, providers });

  return (
    <>
      <div className="page-head"><h1>Settings</h1><span className="hint">of <code>{current}</code></span></div>
      <SettingsTabs active={tab} marks={marks} />
      {tab === "ado" && <AdoIntegrationForm key={current} values={integrationValues(ado)} />}
      {tab === "github" && <GitHubForm key={`github-${current}-${github.owner}-${github.login}`} values={gitHubValues(github)} />}
      {tab === "sync" && <SyncTab db={db} current={current} ado={isAdoActive(ado) ? ado : null} github={isGitHubActive(github) ? github : null} repos={repos} />}
      {tab === "repos" && <RepositoriesPanel repos={repos} reposRoot={process.env.REPOS_ROOT?.trim() || null} adoActive={isAdoActive(ado)} show={["on", "off"].includes(params.show ?? "") ? params.show! : "all"} />}
      {tab === "data" && <DataTab db={db} current={current} readSql={readSql} readAzure={readAzure} driveMessage={params.drive ?? null} />}
      {tab === "devhub" && <DevHubForm key={`stack-${current}`} values={{ enabled: devHub.enabled, url: devHub.url, hasToken: devHub.token.length > 0 }} />}
      {tab === "agents" && <AgentsTab />}
      {tab === "ai" && <AiProvidersTab providers={providers} />}
      <p className="env-line">From .env, restart to change: backlog vault <code>{process.env.VAULT_PATH ?? "not set"}</code> (a folder per vault) · Confluence <ConfluenceAccess status={await readConfluenceStatus(db)} /></p>
    </>
  );
}

interface MarkInputs {
  adoActive: boolean;
  gitHubActive: boolean;
  repos: RepoRow[];
  readSql: ReadSqlSettings;
  readAzure: ReadAzureSettings;
  devHubOn: boolean;
  providers: ProviderStatus[] | null;
}

// Each tab's dot and count; Sync pulses amber while a mail source has been quiet for over a day.
async function tabMarks(db: PowerLoomDb, current: string, inputs: MarkInputs): Promise<Partial<Record<SettingsTab, SettingsTabMark>>> {
  const isQuiet = inputs.adoActive && (await readImportSourceActivity(db, current)).some((activity) => activity.isQuiet);
  const dataOn = inputs.readSql.enabled || Object.values(inputs.readAzure.enabledKinds).some(Boolean);

  return {
    ado: { dot: inputs.adoActive ? "ok" : "off" },
    github: { dot: inputs.gitHubActive ? "ok" : "off" },
    sync: { dot: !inputs.adoActive && !inputs.gitHubActive ? "off" : isQuiet ? "warn" : "ok" },
    repos: { count: `${inputs.repos.filter((row) => !row.excluded).length}/${inputs.repos.length}` },
    data: { dot: dataOn ? "ok" : "off" },
    devhub: { dot: inputs.devHubOn ? "ok" : "off" },
    ai: { dot: inputs.providers?.some((provider) => provider.connected) ? "ok" : "warn" },
  };
}

// Each sync of an integration that is configured (user decisions 2026-10-06, 2026-10-25: Azure DevOps' three, GitHub's
// pull requests), and the artefact cleanup, which needs neither.
async function SyncTab({ db, current, ado, github, repos }: { db: PowerLoomDb; current: string; ado: AdoSettings | null; github: GitHubSettings | null; repos: RepoRow[] }) {
  return (
    <>
      {ado ? <AdoSyncs db={db} current={current} ado={ado} repos={repos} /> : <p className="quiet-line">PBI sync, mail import and Azure DevOps pull requests need the Azure DevOps integration: set it up in the Azure DevOps tab.</p>}
      {github ? <GitHubPullRequestsForm key={`github-prs-${current}`} values={await gitHubPullRequestsValues(db, current, github, repos)} /> : <p className="quiet-line">GitHub pull requests need GitHub: connect it in the GitHub tab.</p>}
      <CleanupSettingsForm key={`cleanup-${current}`} settings={await readCleanupSettings(db, current)} />
    </>
  );
}

async function gitHubPullRequestsValues(db: PowerLoomDb, current: string, github: GitHubSettings, repos: RepoRow[]): Promise<GitHubPullRequestsValues> {
  const repoNames = repos.filter((row) => row.kind === "github" && !row.excluded).map((row) => `${row.adoProject}/${row.name}`);

  return { enabled: github.pullRequestsEnabled, cron: github.pullRequestsCron, login: github.login, repos: github.pullRequestsRepos, repoNames, status: await readGitHubCheckStatus(db, current) };
}

async function AdoSyncs({ db, current, ado, repos }: { db: PowerLoomDb; current: string; ado: AdoSettings; repos: RepoRow[] }) {
  const vault = (await readVault(db, current))!;
  const sync = await readSyncSettings(db, current);
  const importStatus = <ImportStatus status={await readImportStatus(db, current)} activity={await readImportSourceActivity(db, current)} />;

  return (
    <>
      <SettingsForm key={current} enabled={vault.features.adoSync} sync={sync} sprintOptions={await loadSprintChoices(ado)} currentSprint={await readCurrentSprint(db, current)} />
      <ImportSettingsForm key={`import-${current}`} enabled={vault.features.mailSync} importFolder={vault.importFolder} inboxPath={process.env.IMPORT_INBOX_PATH ?? "the import inbox"} settings={await readImportSettings(db, current)} status={importStatus} />
      <PullRequestSettingsForm key={`prs-${current}`} enabled={vault.features.pullRequests} settings={await readPullRequestSettings(db, current)} repoNames={repos.filter((row) => row.kind === "ado" && !row.excluded).map((row) => row.name)} />
    </>
  );
}

// One section for the whole PowerLoom, the same on every vault's page (nothing about providers at installation).
async function AiProvidersTab({ providers }: { providers: ProviderStatus[] | null }) {
  return (
    <>
      <p className="quiet-line">These settings are for the whole PowerLoom, not only this vault.</p>
      <ClaudeTokenForm status={providers?.find((provider) => provider.provider === "anthropic") ?? null} />
      <CodexConnectForm status={providers?.find((provider) => provider.provider === "openai-codex") ?? null} />
      <ChatAppForm apps={await loadChatApps()} />
    </>
  );
}

// Read SQL, the Azure kinds and Google Drive, under one note on where the data goes (user decision 2026-10-18: said once, not five times).
async function DataTab({ db, current, readSql, readAzure, driveMessage }: { db: PowerLoomDb; current: string; readSql: ReadSqlSettings; readAzure: ReadAzureSettings; driveMessage: string | null }) {
  return (
    <>
      <p className="leak-note">Whatever an agent reads here goes to the model provider. Connect only data that may leave this PC, with read-only access. Each agent also needs its own switch on its config page.</p>
      <ReadSqlPanel key={current} enabled={readSql.enabled} connections={connectionRows(readSql)} />
      <ReadAzurePanel key={`azure-${current}`} enabledKinds={readAzure.enabledKinds} account={await readAzureUserAccount(db, current)} subscription={readAzure.subscription} resources={resourceRows(readAzure)} />
      <GoogleDrivePanel key={`drive-${current}`} values={googleDriveValues(await readGoogleDriveSettings(db, current))} message={driveMessage} />
    </>
  );
}

// The browser never gets the secret or the token, only whether a secret is saved.
function googleDriveValues(drive: GoogleDriveSettings): GoogleDriveValues {
  return { enabled: drive.enabled, clientId: drive.clientId, hasClientSecret: drive.clientSecret.length > 0, account: drive.account, folders: drive.folders };
}

// The browser never gets the token, only whether one is saved.
function gitHubValues(github: GitHubSettings): GitHubValues {
  return { enabled: github.enabled, owner: github.owner, login: github.login, hasToken: github.token.length > 0 };
}

function integrationValues(ado: AdoSettings | null): AdoIntegrationValues {
  return { enabled: ado?.enabled ?? false, orgUrl: ado?.orgUrl ?? "", project: ado?.project ?? "", team: ado?.team ?? "", user: ado?.user ?? "", hasPat: !!ado?.pat };
}

// The browser never gets a connection string, only what it points at.
function connectionRows(settings: ReadSqlSettings): SqlConnectionRow[] {
  return settings.connections.map((connection) => ({ name: connection.name, server: connection.server, database: connection.database, enabled: connection.enabled }));
}

// What the page shows per account.
function resourceRows(settings: ReadAzureSettings): AzureResourceRow[] {
  return settings.resources.map((resource) => ({ name: resource.name, kind: resource.kind, display: resource.display, enabled: resource.enabled }));
}

// As the worker reported it at startup (it holds the token): the account, or what to set.
function ConfluenceAccess({ status }: { status: ConfluenceStatus | null }) {
  if (!status) {
    return <>unknown (restart the worker)</>;
  }

  return status.email ? <>set ({status.email})</> : <span className="text-warn">missing (CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN)</span>;
}

// The agents' shared settings: the daily budget and the shared framework their prompts pull in.
async function AgentsTab() {
  const global = await getAgentConfig().getGlobal();
  const versions = await loadPromptVersions(FRAMEWORK_ID);

  return (
    <>
      <GlobalAgentForm global={global} spentTodayUsd={await spentToday()} />
      <FrameworkForm
        stored={global.framework ?? ""}
        storedVersion={global.frameworkVersion ?? 0}
        file={await readPromptFile(FRAMEWORK_ID)}
        versions={versions.map((row) => ({ version: row.version, text: row.text, createdAt: row.createdAt }))}
      />
    </>
  );
}
