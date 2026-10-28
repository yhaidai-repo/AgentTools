import { localItem, planningSnapshot, type PlanContent, type PowerLoomDb } from "@powerloom/db";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { addRunOutputs } from "../tasks/runOutputs";
import { INSPECT_SCHEMA_VERSION } from "./readPlan";

// The task type the plan hands on to (wave 3): no agent handles it yet.
export const IMPLEMENT_TASK_TYPE = "implement";

// TODO(implementation agent): remove this note once an agent handles `implement` tasks.
export const MISSING_IMPLEMENTER_NOTE = "> **TODO:** no agent handles `implement` tasks yet. The task waits for the plan review and then for the implementation agent; until it exists, implement the approved plan by hand or leave the task open.";

// Writes a successful run's plan as the PBI's next version, with the inspect snapshot it was read from.
export async function commitPlan(db: PowerLoomDb, adoId: number, runId: number, plan: { content: PlanContent; inspect: unknown }): Promise<void> {
  const [latest] = await db.select({ version: planningSnapshot.version }).from(planningSnapshot).where(eq(planningSnapshot.pbiId, adoId)).orderBy(desc(planningSnapshot.version)).limit(1);
  const version = (latest?.version ?? 0) + 1;

  await db.insert(planningSnapshot).values({ pbiId: adoId, version, schemaVersion: INSPECT_SCHEMA_VERSION, inspect: plan.inspect, plan: plan.content, runId });
  await addRunOutputs(db, runId, [`plan v${version}`]);
}

// The implementation tasks the run handed on get the note that their agent is missing, above what the plan says.
export async function noteMissingImplementer(db: PowerLoomDb, taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) {
    return;
  }

  await db.update(localItem).set({ body: sql`${MISSING_IMPLEMENTER_NOTE} || E'\\n\\n' || coalesce(${localItem.body}, '')` }).where(inArray(localItem.id, taskIds));
}
