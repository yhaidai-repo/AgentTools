import type { UsageRecord, UsageStore } from "@agenttools/usage";
import { agentRun, localItem, workItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq } from "drizzle-orm";
import type { RunListRow } from "../models/RunListRow";
import { runInVault } from "./vaultRuns";

// One run with the task it worked on; null when it isn't the vault's (every page shows only the vault picked at the top).
export async function loadRun(db: PowerLoomDb, runId: number, vault: string): Promise<Pick<RunListRow, "run" | "task"> | null> {
  const [row] = await db
    .select({ run: agentRun, task: localItem })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(eq(agentRun.id, runId), runInVault(vault)));

  return row ?? null;
}

// The run's usage record: tokens and cost exist once the run ended (the record is written then).
export async function loadRunUsage(usage: UsageStore, runId: number): Promise<UsageRecord | null> {
  const [record] = await usage.records({ from: new Date(0), match: { run: String(runId) } }, 1);

  return record ?? null;
}

export function tokensOf(record: UsageRecord): number {
  return record.inputTokens + record.outputTokens + record.cacheReadTokens + record.cacheWriteTokens;
}
