import { localItem, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { WaitingTaskData } from "./models/WaitingTaskData";
import { addRunOutputs } from "./runOutputs";

type ItemRow = typeof localItem.$inferSelect;

export function dependenciesOf(task: ItemRow): string[] {
  return (task.data as WaitingTaskData | null)?.dependsOn ?? [];
}

// The task waits for what its run created (user decision 2026-10-14): the ids join data.dependsOn, which the
// dispatcher checks before starting it again, and the task and the run say so.
export async function recordWaiting(db: PowerLoomDb, task: ItemRow, runId: number, createdIds: string[]): Promise<void> {
  const dependsOn = [...new Set([...dependenciesOf(task), ...createdIds])];
  const waiting = `Waiting for ${createdIds.join(", ")}`;

  await db.update(localItem).set({ data: { ...(task.data as object), dependsOn }, heldBy: [waiting] }).where(eq(localItem.id, task.id));
  await addRunOutputs(db, runId, [waiting]);
}
