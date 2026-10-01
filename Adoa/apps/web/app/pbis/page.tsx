import { readAdoSettings } from "@adoa/core";
import { agentRun, workItem, type AdoaDb } from "@adoa/db";
import { and, asc, desc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { BacklogFilter } from "@/models/BacklogFilter";
import type { BacklogRow } from "@/models/BacklogRow";
import { BacklogFilters } from "./BacklogFilters";
import { LastSync } from "./LastSync";
import { PbiTable } from "./PbiTable";
import { PrepareForm } from "./PrepareForm";
import { StatusChips } from "./StatusChips";
import { SyncNowButton } from "./SyncNowButton";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ sprint?: string; state?: string; outOfScope?: string }>;

export default async function PbisPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filter: BacklogFilter = { sprint: params.sprint ?? "", state: params.state ?? "", showOutOfScope: params.outOfScope === "1" };
  const db = getDb();
  const rows = await loadRows(db, filter);
  const [lastSync] = await db.select().from(agentRun).where(eq(agentRun.stage, "sync")).orderBy(desc(agentRun.id)).limit(1);

  return (
    <>
      <h1>Backlog</h1>
      <div className="toolbar">
        <SyncNowButton />
        <LastSync run={lastSync} />
      </div>
      <BacklogFilters filter={filter} sprints={await distinctValues(db, workItem.iterationPath)} states={await distinctValues(db, workItem.adoState)} />
      <StatusChips rows={rows} />
      <PrepareForm>
        <PbiTable rows={rows} ado={await readAdoSettings(db)} />
      </PrepareForm>
      {rows.length === 0 && <p className="muted">No PBIs match. Check the filters or Settings, then run a sync.</p>}
    </>
  );
}

async function loadRows(db: AdoaDb, filter: BacklogFilter): Promise<BacklogRow[]> {
  const conditions: SQL[] = [];

  if (!filter.showOutOfScope) {
    conditions.push(eq(workItem.outOfScope, false));
  }

  if (filter.sprint) {
    conditions.push(eq(workItem.iterationPath, filter.sprint));
  }

  if (filter.state) {
    conditions.push(eq(workItem.adoState, filter.state));
  }

  return db
    .select({ ...getTableColumns(workItem), openForYou: openForYou() })
    .from(workItem)
    .where(and(...conditions))
    .orderBy(asc(workItem.outOfScope), asc(workItem.backlogPriority), asc(workItem.adoId));
}

function openForYou(): SQL<number> {
  return sql<number>`(SELECT count(*)::int FROM local_item i WHERE i.pbi_id = ${workItem.adoId} AND i.assignee = 'human' AND i.status IN ('open', 'in-progress'))`;
}

async function distinctValues(db: AdoaDb, column: typeof workItem.iterationPath | typeof workItem.adoState): Promise<string[]> {
  const rows = await db.selectDistinct({ value: column }).from(workItem).orderBy(desc(column));

  return rows.map((row) => row.value).filter((value): value is string => !!value);
}
