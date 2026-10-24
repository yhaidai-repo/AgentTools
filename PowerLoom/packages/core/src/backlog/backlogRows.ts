import { bug, workItem, type PowerLoomDb } from "@powerloom/db";
import { eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { BacklogRow } from "../models/BacklogRow";

// Every PBI of the vault: the status filter is applied while grouping, so a matching child keeps its parent as context.
export async function loadBacklogRows(db: PowerLoomDb, vault: string): Promise<BacklogRow[]> {
  const rows = await db
    .select({ ...getTableColumns(workItem), openForYou: openForYou(), findingsToReview: findingsToReview(), bugSource: bug.source, changedAt: changedAt() })
    .from(workItem)
    .leftJoin(bug, eq(bug.workItemId, workItem.adoId))
    .where(eq(workItem.vault, vault));

  // Raw SQL hands timestamps over as text.
  return rows.map((row) => ({ ...row, changedAt: new Date(row.changedAt) }));
}

// One PBI's latest change, as the Backlog sorts by it (its page shows it as "Updated").
export async function loadChangedAt(db: PowerLoomDb, adoId: number): Promise<Date> {
  const [row] = await db.select({ at: changedAt() }).from(workItem).where(eq(workItem.adoId, adoId));

  return new Date(row?.at ?? Date.now());
}

// The vault's latest PBI sync: the newest synced_at of its PBIs, as PowerLoom's status counts it (user decision
// 2026-10-18: the Backlog shows its own vault's sync, not any vault's last sync run).
export async function loadLastSyncedAt(db: PowerLoomDb, vault: string): Promise<Date | null> {
  const [row] = await db.select({ at: sql<string | null>`max(${workItem.syncedAt})` }).from(workItem).where(eq(workItem.vault, vault));

  return row?.at ? new Date(row.at) : null;
}

// The same items the PBI page calls "needs your action": findings wait for review but hold no agent, so they're counted apart.
function openForYou(): SQL<number> {
  return sql<number>`(SELECT count(*)::int FROM local_item i WHERE i.pbi_id = ${workItem.adoId} AND i.assignee = 'human' AND i.kind <> 'finding' AND i.status IN ('open', 'in-progress'))`;
}

function findingsToReview(): SQL<number> {
  return sql<number>`(SELECT count(*)::int FROM local_item i WHERE i.pbi_id = ${workItem.adoId} AND i.kind = 'finding' AND i.status IN ('open', 'in-progress'))`;
}

// The latest change in either place: Azure DevOps's own change date, the PBI's status history, or any of its tasks
// and questions changing.
function changedAt(): SQL<string> {
  return sql<string>`greatest(
    coalesce(${workItem.adoChangedAt}, ${workItem.createdAt}),
    (SELECT max(h.at) FROM status_history h WHERE h.entity_kind = 'pbi' AND h.entity_id = ${workItem.adoId}::text),
    (SELECT max(i.updated_at) FROM local_item i WHERE i.pbi_id = ${workItem.adoId})
  )`;
}
