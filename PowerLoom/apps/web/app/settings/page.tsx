import { isAdoActive, listVaultRepos, readAdoSettings, readConfluenceStatus, readCurrentSprint, readImportSettings, readImportSourceActivity, readImportStatus, readPullRequestSettings, readReadAzureSettings, readReadSqlSettings, readSyncSettings, readVault, type AdoSettings, type ConfluenceStatus, type ReadAzureSettings, type ReadSqlSettings, type RepoRow } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import type { AdoIntegrationValues } from "@/models/AdoIntegrationValues";
import type { AzureIdentityValues } from "@/models/AzureIdentityValues";
import type { AzureResourceRow } from "@/models/AzureResourceRow";
import type { SqlConnectionRow } from "@/models/SqlConnectionRow";
import { AdoIntegrationForm } from "./AdoIntegrationForm";
import { RepositoriesPanel } from "./RepositoriesPanel";
import Link from "next/link";
import { getAgentConfig } from "@/lib/agentConfig";
import { spentToday } from "@/lib/budgetUsage";
import { getDb } from "@/lib/db";
import { currentVault } from "@/lib/currentVault";
import { NoVault } from "@/components/NoVault";
import { loadSprintChoices } from "@/lib/sprints";
import { GlobalAgentForm } from "./GlobalAgentForm";
import { ImportSettingsForm } from "./ImportSettingsForm";
import { ImportStatus } from "./ImportStatus";
import { PullRequestSettingsForm } from "./PullRequestSettingsForm";
import { ReadAzurePanel } from "./ReadAzurePanel";
import { ReadSqlPanel } from "./ReadSqlPanel";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = getDb();
  const current = await currentVault();

  if (!current) {
    return <NoVault title="Settings" />;
  }

  const vault = (await readVault(db, current))!;
  const ado = await readAdoSettings(db, current);
  const adoActive = isAdoActive(ado);
  const repos = await listVaultRepos(db, current);
  const readSql = await readReadSqlSettings(db, current);
  const readAzure = await readReadAzureSettings(db, current);

  return (
    <>
      <h1>Settings</h1>
      <p className="muted">The settings of <code>{current}</code>; each feature has its switch. The Vault menu in the top bar switches, adds and configures vaults.</p>
      <h2>Azure DevOps integration</h2>
      <AdoIntegrationForm key={current} values={integrationValues(ado)} />
      {adoActive ? <AdoSections db={db} current={current} vault={vault} ado={ado} repos={repos} /> : <p className="muted">PBI sync, mail sync and pull request sync need the Azure DevOps integration: enable and save it above.</p>}
      <h2>Repositories</h2>
      <p className="muted">What agents clone and the PBI page offers: the integration&apos;s repositories (listed by the PBI sync) and local checkouts, each on or off.</p>
      <RepositoriesPanel repos={repos} reposRoot={process.env.REPOS_ROOT?.trim() || null} adoActive={adoActive} />
      <h2>Read SQL</h2>
      <ReadSqlPanel key={current} enabled={readSql.enabled} connections={connectionRows(readSql)} />
      <h2>Read Azure</h2>
      <ReadAzurePanel key={`azure-${current}`} enabled={readAzure.enabled} identity={identityValues(readAzure)} resources={resourceRows(readAzure)} />
      <h2>Agents</h2>
      <GlobalAgentForm global={await getAgentConfig().getGlobal()} spentTodayUsd={await spentToday()} />
      <p className="muted">Per-agent settings (model, schedule, limits, budgets) are on the <Link href="/agents">Agents</Link> page: the Config button in each agent's row.</p>
      <h2>From .env (restart to change)</h2>
      <p className="muted">
        Backlog vault: <code>{process.env.VAULT_PATH ?? "not set"}</code> (a folder per vault) · Confluence: <ConfluenceAccess status={await readConfluenceStatus(db)} />
      </p>
    </>
  );
}

// The three syncs of an active integration (user decision 2026-10-06: not offered without one).
async function AdoSections({ db, current, vault, ado, repos }: { db: PowerLoomDb; current: string; vault: NonNullable<Awaited<ReturnType<typeof readVault>>>; ado: AdoSettings; repos: RepoRow[] }) {
  const sync = await readSyncSettings(db, current);

  return (
    <>
      <h2>PBI sync</h2>
      <SettingsForm key={current} enabled={vault.features.adoSync} sync={sync} sprintOptions={await loadSprintChoices(ado)} currentSprint={await readCurrentSprint(db, current)} />
      <h2>Mail sync (PBI import)</h2>
      <p className="muted">The import job reads every source (Outlook mails from the exporter, JSON requests in the import inbox); each PBI is synced and, if new, prepared for refinement. Results are on the Backlog.</p>
      <ImportSettingsForm key={current} enabled={vault.features.mailSync} importFolder={vault.importFolder} inboxPath={process.env.IMPORT_INBOX_PATH ?? "the import inbox"} settings={await readImportSettings(db, current)} />
      <ImportStatus status={await readImportStatus(db, current)} activity={await readImportSourceActivity(db, current)} />
      <h2>Pull request sync (code review)</h2>
      <p className="muted">Lists the active Azure DevOps PRs where you&apos;re a reviewer; a new PR gets a review on the <Link href="/reviews">Reviews</Link> page. The code-review agent itself is configured on the Agents page.</p>
      <PullRequestSettingsForm key={current} enabled={vault.features.pullRequests} settings={await readPullRequestSettings(db, current)} repoNames={repos.filter((row) => row.kind === "ado" && !row.excluded).map((row) => row.name)} />
    </>
  );
}

// The browser never gets the token, only whether one is saved.
function integrationValues(ado: AdoSettings | null): AdoIntegrationValues {
  return { enabled: ado?.enabled ?? false, orgUrl: ado?.orgUrl ?? "", project: ado?.project ?? "", team: ado?.team ?? "", user: ado?.user ?? "", hasPat: !!ado?.pat };
}

// The browser never gets a connection string, only what it points at.
function connectionRows(settings: ReadSqlSettings): SqlConnectionRow[] {
  return settings.connections.map((connection) => ({ name: connection.name, server: connection.server, database: connection.database, enabled: connection.enabled }));
}

// The browser never gets the secret or a Mongo string, only whether a secret is saved and a resource's display.
function identityValues(settings: ReadAzureSettings): AzureIdentityValues {
  return { tenantId: settings.identity?.tenantId ?? "", clientId: settings.identity?.clientId ?? "", hasSecret: !!settings.identity?.clientSecret };
}

function resourceRows(settings: ReadAzureSettings): AzureResourceRow[] {
  return settings.resources.map((resource) => ({ name: resource.name, kind: resource.kind, display: resource.display, enabled: resource.enabled }));
}

// As the worker reported it at startup (it holds the token): the account, or what to set.
function ConfluenceAccess({ status }: { status: ConfluenceStatus | null }) {
  if (!status) {
    return <>unknown (restart the worker)</>;
  }

  return status.email ? <>set ({status.email})</> : <span className="result-error">missing (CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN)</span>;
}
