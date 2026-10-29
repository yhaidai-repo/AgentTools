import type { PlanContent } from "@powerloom/db";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface PlanDraft {
  plan: { content: PlanContent; inspect: unknown } | null;
}
