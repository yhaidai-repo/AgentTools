import { readAdoSettings, readCurrentSprint, readRecentImports, readSyncSettings } from "@adoa/core";
import { agentRun, pipelineStatus, workItem, type AdoaDb } from "@adoa/db";
import { asc, desc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { RememberFilters } from "@/components/RememberFilters";
import { rememberedParams } from "@/lib/rememberedFilters";
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

// Every PBI in adoa, also those the sync no longer pulls (user decision 2026-10-02): status is the only filter. The
// sprint picker only says what the sync pulls.
export default async function PbisPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await rememberedParams("/pbis", await searchParams);
  const filter: BacklogFilter = { status: STATUSES.find((status) => status === params.status) ?? "" };
  const db = getDb();
  const sync = await readSyncSettings(db);
  const ado = await readAdoSettings(db);
  const rows = await loadRows(db, filter);
  const [lastSync] = await db.select().from(agentRun).where(eq(agentRun.stage, "sync")).orderBy(desc(agentRun.id)).limit(1);

  return (
    <>
      <h1>Backlog</h1>
      <RememberFilters />
      <div className="chips">
        <AutoRefresh active intervalMs={BACKLOG_REFRESH_MS} />
      </div>
      <div className="toolbar">
        <SyncForm sprint={sync.sprint} options={await loadSprintChoices(ado)} current={await readCurrentSprint(db)} />
        <LastSync run={lastSync} />
        <SyncPbiForm />
      </div>
      <StatusFilter key={filter.status} status={filter.status} statuses={STATUSES} />
      <StatusChips rows={rows} />
      <BacklogForm>
        <PbiTable rows={rows} ado={ado} />
      </BacklogForm>
      {rows.length === 0 && <p className="muted">No PBIs match. Check the status, or sync a sprint.</p>}
      <ImportsPanel imports={await readRecentImports(db, null, IMPORTS_SHOWN)} />
    </>
  );
}

async function loadRows(db: AdoaDb, filter: BacklogFilter): Promise<BacklogRow[]> {
  const byStatus = filter.status ? sql`${workItem.pipelineStatus} = ${filter.status}` : undefined;

  return db
    .select({ ...getTableColumns(workItem), openForYou: openForYou(), findingsToReview: findingsToReview() })
    .from(workItem)
    .where(byStatus)
    .orderBy(asc(workItem.backlogPriority), asc(workItem.adoId));
}

// The same items the PBI page calls "needs your action": findings wait for review but hold no agent, so they're counted apart.
function openForYou(): SQL<number> {
  return sql<number>`(SELECT count(*)::int FROM local_item i WHERE i.pbi_id = ${workItem.adoId} AND i.assignee = 'human' AND i.kind <> 'finding' AND i.status IN ('open', 'in-progress'))`;
}

function findingsToReview(): SQL<number> {
  return sql<number>`(SELECT count(*)::int FROM local_item i WHERE i.pbi_id = ${workItem.adoId} AND i.kind = 'finding' AND i.status IN ('open', 'in-progress'))`;
}
