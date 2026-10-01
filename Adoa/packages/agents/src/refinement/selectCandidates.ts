import { readCurrentSprint } from "@adoa/core";
import { workItem, type AdoaDb } from "@adoa/db";
import { sql } from "drizzle-orm";

type WorkItemRow = typeof workItem.$inferSelect;

// PBIs ready for refinement: current sprint first, then ADO backlog order. A PBI that failed
// `maxFailures` times since the user last prepared it is skipped until they prepare it again.
export async function selectCandidates(db: AdoaDb, batchSize: number, maxFailures: number): Promise<WorkItemRow[]> {
  const currentSprint = (await readCurrentSprint(db)) ?? "";
  const failuresSincePrepare = sql`(
    SELECT count(*) FROM agent_run r
    WHERE r.pbi_id = ${workItem.adoId} AND r.stage = 'refinement' AND r.outcome NOT IN ('success', 'running')
      AND r.started_at > coalesce((
        SELECT max(h.at) FROM status_history h
        WHERE h.entity_kind = 'pbi' AND h.entity_id = ${workItem.adoId}::text
          AND h.to_status = 'ready-for-refinement' AND h.actor = 'human'), 'epoch'))`;

  return db
    .select()
    .from(workItem)
    .where(sql`${workItem.pipelineStatus} = 'ready-for-refinement' AND NOT ${workItem.outOfScope} AND ${failuresSincePrepare} < ${maxFailures}`)
    .orderBy(sql`${workItem.iterationPath} = ${currentSprint} DESC NULLS LAST`, sql`${workItem.backlogPriority} ASC NULLS LAST`, workItem.adoId)
    .limit(batchSize);
}
