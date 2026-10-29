import { agentRun, localItem, workItem, type PowerLoomDb } from "@powerloom/db";
import { and, asc, eq } from "drizzle-orm";
import { runInVault } from "./vaultRuns";

// One agent's runs in progress in the selected vault, oldest first.
export function loadRunningRuns(db: PowerLoomDb, agentId: string, vault: string) {
  return db
    .select({ id: agentRun.id, stage: agentRun.stage, itemId: agentRun.itemId, pbiId: agentRun.pbiId, startedAt: agentRun.startedAt })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(eq(agentRun.stage, agentId), eq(agentRun.outcome, "running"), runInVault(vault)))
    .orderBy(asc(agentRun.id));
}

// The ids of every run in progress in the selected vault, oldest first: a page compares them with the ones it was drawn with.
export async function loadRunningRunIds(db: PowerLoomDb, vault: string): Promise<number[]> {
  const rows = await db
    .select({ id: agentRun.id })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(eq(agentRun.outcome, "running"), runInVault(vault)))
    .orderBy(asc(agentRun.id));

  return rows.map((row) => row.id);
}
