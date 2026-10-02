import { readAdoSettings, readCurrentSprint, readSyncSettings } from "@adoa/core";
import { agentRun, pipelineStatus, workItem, type AdoaDb } from "@adoa/db";
import { and, asc, desc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { RememberFilters } from "@/components/RememberFilters";
import { rememberedParams } from "@/lib/rememberedFilters";
import { loadSprintChoices } from "@/lib/sprints";
import type { BacklogFilter } from "@/models/BacklogFilter";
import type { BacklogRow } from "@/models/BacklogRow";
import { LastSync } from "./LastSync";
import { PbiTable } from "./PbiTable";
import { PrepareForm } from "./PrepareForm";
import { StatusChips } from "./StatusChips";
import { StatusFilter } from "./StatusFilter";
import { SyncForm } from "./SyncForm";
import { SyncPbiForm } from "./SyncPbiForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string }>;

const STATUSES: string[] = pipelineStatus.enumValues;

// Every synced PBI in scope; the sprint picker only says what the sync pulls.
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
      <div className="toolbar">
        <SyncForm sprint={sync.sprint} options={await loadSprintChoices(ado)} current={await readCurrentSprint(db)} />
        <LastSync run={lastSync} />
        <SyncPbiForm />
      </div>
      <StatusFilter key={filter.status} status={filter.status} statuses={STATUSES} />
      <StatusChips rows={rows} />
      <PrepareForm>
        <PbiTable rows={rows} ado={ado} />
      </PrepareForm>
      {rows.length === 0 && <p className="muted">No PBIs match. Check the status, or sync a sprint.</p>}
    </>
  );
}

async function loadRows(db: AdoaDb, filter: BacklogFilter): Promise<BacklogRow[]> {
  const conditions: SQL[] = [eq(workItem.outOfScope, false)];

  if (filter.status) {
    conditions.push(sql`${workItem.pipelineStatus} = ${filter.status}`);
  }

  return db
    .select({ ...getTableColumns(workItem), openForYou: openForYou() })
    .from(workItem)
    .where(and(...conditions))
    .orderBy(asc(workItem.backlogPriority), asc(workItem.adoId));
}

function openForYou(): SQL<number> {
  return sql<number>`(SELECT count(*)::int FROM local_item i WHERE i.pbi_id = ${workItem.adoId} AND i.assignee = 'human' AND i.status IN ('open', 'in-progress'))`;
}
