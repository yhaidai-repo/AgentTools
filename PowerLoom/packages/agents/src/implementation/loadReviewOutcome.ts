import { dependsOnOf, loadHandoffsInto, type HandoffView } from "@powerloom/core";
import { planningSnapshot, type PowerLoomDb, type localItem, type workItem } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import type { ReviewFacts } from "./models/ReviewFacts";
import type { ReviewOutcome } from "./models/ReviewOutcome";
import { decideReviewOutcome } from "./reviewOutcome";

type ItemRow = typeof localItem.$inferSelect;
type PbiRow = typeof workItem.$inferSelect;

// The outcome of the plan review the task waits for, against the PBI's latest plan and its content now.
export async function loadReviewOutcome(db: PowerLoomDb, task: ItemRow, pbi: PbiRow): Promise<ReviewOutcome> {
  return decideReviewOutcome(await reviewFacts(db, task, pbi));
}

async function reviewFacts(db: PowerLoomDb, task: ItemRow, pbi: PbiRow): Promise<ReviewFacts> {
  const handoffs = await loadHandoffsInto(db, dependsOnOf(task.data));
  const [plan] = await db.select({ version: planningSnapshot.version, pbiContentHash: planningSnapshot.pbiContentHash })
    .from(planningSnapshot).where(eq(planningSnapshot.pbiId, pbi.adoId)).orderBy(desc(planningSnapshot.version)).limit(1);

  return { reviews: handoffs.filter(isPlanReview), plan: plan ?? null, pbiContentHash: pbi.contentHash };
}

function isPlanReview(handoff: HandoffView): boolean {
  return handoff.intent === "review" && handoff.gate === "approve";
}
