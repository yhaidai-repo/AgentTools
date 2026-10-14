import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";

// Appends to what a run lists as its outputs (the run page), after the runner's own commit set them.
export async function addRunOutputs(db: PowerLoomDb, runId: number, outputs: string[]): Promise<void> {
  if (outputs.length === 0) {
    return;
  }

  const [row] = await db.select({ outputs: agentRun.outputs }).from(agentRun).where(eq(agentRun.id, runId));

  await db.update(agentRun).set({ outputs: [...(row?.outputs ?? []), ...outputs] }).where(eq(agentRun.id, runId));
}
