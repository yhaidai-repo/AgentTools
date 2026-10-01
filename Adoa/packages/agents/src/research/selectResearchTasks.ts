import { readCurrentSprint } from "@adoa/core";
import { localItem, workItem, type AdoaDb } from "@adoa/db";
import { and, eq, lt, sql } from "drizzle-orm";

type TaskRow = typeof localItem.$inferSelect;

// Open research tasks of PBIs that need research: current sprint first, then ADO backlog order.
// A task that failed `maxFailures` times is set to blocked and no longer picked.
export async function selectResearchTasks(db: AdoaDb, batchSize: number, maxFailures: number): Promise<TaskRow[]> {
  const currentSprint = (await readCurrentSprint(db)) ?? "";
  const rows = await db
    .select({ task: localItem })
    .from(localItem)
    .innerJoin(workItem, eq(workItem.adoId, localItem.pbiId))
    .where(and(
      eq(localItem.kind, "research"),
      eq(localItem.status, "open"),
      lt(localItem.attempts, maxFailures),
      sql`${workItem.pipelineStatus} IN ('needs-research', 'researching')`,
      eq(workItem.outOfScope, false),
    ))
    .orderBy(sql`${workItem.iterationPath} = ${currentSprint} DESC NULLS LAST`, sql`${workItem.backlogPriority} ASC NULLS LAST`, localItem.id)
    .limit(batchSize);

  return rows.map((row) => row.task);
}
