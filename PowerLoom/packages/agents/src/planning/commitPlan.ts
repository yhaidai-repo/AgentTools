import { localItem, planningSnapshot, type PlanContent, type PowerLoomDb } from "@powerloom/db";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { addRunOutputs } from "../tasks/runOutputs";
import { INSPECT_SCHEMA_VERSION } from "./readPlan";

// The task type the plan hands on to: the implementation agent takes it.
export const IMPLEMENT_TASK_TYPE = "implement";

// Writes a successful run's plan as the PBI's next version, with the inspect snapshot it was read from and the PBI's
// content hash it was made from (implementation compares it with the PBI's current one).
export async function commitPlan(db: PowerLoomDb, adoId: number, runId: number, plan: { content: PlanContent; inspect: unknown }, pbiContentHash: string | null): Promise<void> {
  const [latest] = await db.select({ version: planningSnapshot.version }).from(planningSnapshot).where(eq(planningSnapshot.pbiId, adoId)).orderBy(desc(planningSnapshot.version)).limit(1);
  const version = (latest?.version ?? 0) + 1;

  await db.insert(planningSnapshot).values({ pbiId: adoId, version, schemaVersion: INSPECT_SCHEMA_VERSION, inspect: plan.inspect, plan: plan.content, pbiContentHash, runId });
  await addRunOutputs(db, runId, [`plan v${version}`]);
}

// The implementation agent reads the review's answers itself (user decision 2026-10-29): its tasks are marked, so the
// gate lets a review that asked for changes through to it (HandoffGates.cs), and it hands the changes back to planning.
export async function markReviewReaders(db: PowerLoomDb, taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) {
    return;
  }

  await db.update(localItem).set({ data: sql`coalesce(${localItem.data}, '{}'::jsonb) || jsonb_build_object('readsReview', true)` }).where(inArray(localItem.id, taskIds));
}
