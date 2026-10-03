import { readAdoSettings, readConfluenceStatus, readCurrentSprint, readImportSettings, readImportSourceActivity, readImportStatus, readPullRequestSettings, readSyncSettings, type ConfluenceStatus } from "@adoa/core";
import { repo, type AdoaDb } from "@adoa/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getAgentConfig } from "@/lib/agentConfig";
import { spentToday } from "@/lib/budgetUsage";
import { getDb } from "@/lib/db";
import { backlogFolder } from "@/lib/obsidian";
import { loadSprintChoices } from "@/lib/sprints";
import { GlobalAgentForm } from "./GlobalAgentForm";
import { ImportSettingsForm } from "./ImportSettingsForm";
import { ImportStatus } from "./ImportStatus";
import { PullRequestSettingsForm } from "./PullRequestSettingsForm";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = getDb();
  const ado = await readAdoSettings(db);
  const sync = await readSyncSettings(db);
  const sprintOptions = await loadSprintChoices(ado);

  return (
    <>
      <h1>Settings</h1>
      <SettingsForm ado={ado ?? { orgUrl: "", project: "", team: "", user: "" }} sync={sync} sprintOptions={sprintOptions} currentSprint={await readCurrentSprint(db)} />
      <h2>PBI import</h2>
      <p className="muted">The import job reads every source (Outlook mails from the exporter, JSON requests in the import inbox); each PBI is synced and, if new, prepared for refinement. Results are on the Backlog.</p>
      <ImportSettingsForm settings={await readImportSettings(db)} />
      <ImportStatus status={await readImportStatus(db)} activity={await readImportSourceActivity(db)} />
      <h2>Code review</h2>
      <p className="muted">Lists the active Azure DevOps PRs where you&apos;re a reviewer; a new PR gets a review on the <Link href="/reviews">Reviews</Link> page. The code-review agent itself is configured on the Agents page.</p>
      <PullRequestSettingsForm settings={await readPullRequestSettings(db)} repoNames={await loadRepoNames(db)} />
      <h2>Agents</h2>
      <GlobalAgentForm global={await getAgentConfig().getGlobal()} spentTodayUsd={await spentToday()} />
      <p className="muted">Per-agent settings (model, schedule, limits, budgets) are on the <Link href="/agents">Agents</Link> page: the Config button in each agent's row.</p>
      <h2>From .env (restart to change)</h2>
      <p className="muted">
        Vault: <code>{process.env.VAULT_PATH ?? "not set"}</code> · backlog folder: <code>{backlogFolder() || "(vault root)"}</code> · ADO access token:{" "}
        {process.env.ADO_PAT ? "set" : "missing"} · Confluence: <ConfluenceAccess status={await readConfluenceStatus(db)} />
      </p>
    </>
  );
}

// The repo catalog the sync keeps (excluded repos left out), for the code review repo choice.
async function loadRepoNames(db: AdoaDb): Promise<string[]> {
  const rows = await db.select({ name: repo.name }).from(repo).where(eq(repo.excluded, false)).orderBy(asc(repo.name));

  return rows.map((row) => row.name);
}

// As the worker reported it at startup (it holds the token): the account, or what to set.
function ConfluenceAccess({ status }: { status: ConfluenceStatus | null }) {
  if (!status) {
    return <>unknown (restart the worker)</>;
  }

  return status.email ? <>set ({status.email})</> : <span className="result-error">missing (CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN)</span>;
}
