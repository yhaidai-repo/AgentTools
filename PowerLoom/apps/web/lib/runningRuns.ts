import { agentRun, localItem, workItem } from "@powerloom/db";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { runInVault } from "./vaultRuns";

// One agent's runs in progress in the selected vault, oldest first.
export function loadRunningRuns(agentId: string, vault: string) {
  return getDb()
    .select({ id: agentRun.id, stage: agentRun.stage, itemId: agentRun.itemId, pbiId: agentRun.pbiId, startedAt: agentRun.startedAt })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(eq(agentRun.stage, agentId as typeof agentRun.$inferSelect["stage"]), eq(agentRun.outcome, "running"), runInVault(vault)))
    .orderBy(asc(agentRun.id));
}
