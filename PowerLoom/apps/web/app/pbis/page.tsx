import { isAdoActive, readAdoSettings, readCurrentSprint, readRecentImports, readSyncSettings } from "@powerloom/core";
import { agentRun, bug, pipelineStatus, workItem, type PowerLoomDb } from "@powerloom/db";
import { asc, desc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { NoVault } from "@/components/NoVault";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { RememberFilters } from "@/components/RememberFilters";
import { rememberedParams } from "@/lib/rememberedFilters";
import { groupBacklogRows } from "@/lib/backlogGroups";
import { loadSprintChoices } from "@/lib/sprints";
import type { BacklogFilter } from "@/models/BacklogFilter";
import type { BacklogRow } from "@/models/BacklogRow";
import { ImportsPanel } from "./ImportsPanel";
import { LastSync } from "./LastSync";
import { PbiTable } from "./PbiTable";
import { BacklogForm } from "./BacklogForm";
import { StatusChips } from "./StatusChips";
import { StatusFilter } from "./StatusFilter";
import { SyncForm } from "./SyncForm";
import { SyncPbiForm } from "./SyncPbiForm";

export const dynamic = "force-dynamic";

// Agents move PBIs between statuses all the time; the grid follows without a reload (user decision 2026-10-02).
const BACKLOG_REFRESH_MS = 10_000;
const IMPORTS_SHOWN = 20;

type SearchParams = Promise<{ status?: string }>;

const STATUSES: string[] = pipelineStatus.enumValues;

// Every PBI in PowerLoom, also those the sync no longer pulls (user decision 2026-10-02): status is the only filter. The
// sprint picker only says what the sync pulls.
export default async function PbisPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await rememberedParams("/pbis", await searchParams);
  const filter: BacklogFilter = { status: STATUSES.find((status) => status === params.status) ?? "" };
  const db = getDb();
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Backlog" />;
  }

  const sync = await readSyncSettings(db, vault);
  const ado = await readAdoSettings(db, vault);
  const all = await loadRows(db, vault);
  const matches = (row: BacklogRow) => !filter.status || row.pipelineStatus === filter.status;
  const rows = all.filter(matches);
  const [lastSync] = await db.select().from(agentRun).where(eq(agentRun.stage, "sync")).orderBy(desc(agentRun.id)).limit(1);

  return (
    <>
      <h1>Backlog</h1>
      <RememberFilters />
      <div className="chips">
        <AutoRefresh active intervalMs={BACKLOG_REFRESH_MS} />
        <Link className="button" href="/pbis/new">New PBI</Link>
      </div>
      <StatusFilter key={filter.status} status={filter.status} statuses={STATUSES} />
      <StatusChips rows={rows} />
      <BacklogForm>
        <PbiTable groups={groupBacklogRows(all, matches)} ado={ado} />
      </BacklogForm>
      {rows.length === 0 && <p className="muted">No PBIs match. Check the status, or sync a sprint.</p>}
      {/* Everything Azure DevOps brings in sits together, only with the vault's integration on (user decision 2026-10-06). */}
      {isAdoActive(ado) ? (
        <>
          <h2>PBI sync</h2>
          <div className="toolbar">
            <SyncForm sprint={sync.sprint} options={await loadSprintChoices(ado)} current={await readCurrentSprint(db, vault)} />
            <LastSync run={lastSync} />
            <SyncPbiForm />
          </div>
          <ImportsPanel imports={await readRecentImports(db, vault, null, IMPORTS_SHOWN)} />
        </>
      ) : (
        <p className="muted">No Azure DevOps integration for <code>{vault}</code>: enable it in <Link href="/settings">Settings</Link> to sync and import PBIs.</p>
      )}
    </>
  );
}

// Every PBI of the vault: the status filter is applied while grouping, so a matching child keeps its parent as context.
async function loadRows(db: PowerLoomDb, vault: string): Promise<BacklogRow[]> {
  return db
    .select({ ...getTableColumns(workItem), openForYou: openForYou(), findingsToReview: findingsToReview(), bugSource: bug.source })
    .from(workItem)
    .leftJoin(bug, eq(bug.workItemId, workItem.adoId))
    .where(eq(workItem.vault, vault))
    .orderBy(asc(workItem.backlogPriority), asc(workItem.adoId));
}

// The same items the PBI page calls "needs your action": findings wait for review but hold no agent, so they're counted apart.
function openForYou(): SQL<number> {
  return sql<number>`(SELECT count(*)::int FROM local_item i WHERE i.pbi_id = ${workItem.adoId} AND i.assignee = 'human' AND i.kind <> 'finding' AND i.status IN ('open', 'in-progress'))`;
}

function findingsToReview(): SQL<number> {
  return sql<number>`(SELECT count(*)::int FROM local_item i WHERE i.pbi_id = ${workItem.adoId} AND i.kind = 'finding' AND i.status IN ('open', 'in-progress'))`;
}
