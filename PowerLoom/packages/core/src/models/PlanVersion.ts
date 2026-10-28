import type { PlanContent } from "@powerloom/db";

// One stored version of a PBI's plan, without the inspect snapshot it was read from.
export interface PlanVersion {
  id: number;
  pbiId: number;
  version: number;
  runId: number | null;
  createdAt: Date;
  plan: PlanContent;
}
