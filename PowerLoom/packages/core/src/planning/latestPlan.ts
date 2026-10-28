import { planningSnapshot, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import type { PlanVersion } from "../models/PlanVersion";

const PLAN_COLUMNS = {
  id: planningSnapshot.id,
  pbiId: planningSnapshot.pbiId,
  version: planningSnapshot.version,
  runId: planningSnapshot.runId,
  createdAt: planningSnapshot.createdAt,
  plan: planningSnapshot.plan,
};

// The PBI's latest plan (the planning agent's write_plan); the inspect snapshot stays in the table for audits.
export async function latestPlan(db: PowerLoomDb, adoId: number): Promise<PlanVersion | null> {
  const [row] = await db.select(PLAN_COLUMNS).from(planningSnapshot).where(eq(planningSnapshot.pbiId, adoId)).orderBy(desc(planningSnapshot.version)).limit(1);

  return row ?? null;
}

// One plan version by its row id, as the result pages link it.
export async function planById(db: PowerLoomDb, id: number): Promise<PlanVersion | null> {
  const [row] = await db.select(PLAN_COLUMNS).from(planningSnapshot).where(eq(planningSnapshot.id, id));

  return row ?? null;
}

// The plan in a few lines, for a child item's parent block and reference titles.
export function planLines(latest: PlanVersion): string[] {
  const plans = latest.plan.plans.map((plan) => `- ${plan.id} (wave ${plan.wave}): ${plan.objective || "-"}`);

  return [`Plan v${latest.version}: ${latest.plan.summary || "-"}`, "Plans:", ...(plans.length > 0 ? plans : ["- none"])];
}
