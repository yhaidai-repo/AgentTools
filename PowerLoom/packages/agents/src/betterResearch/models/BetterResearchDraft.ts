import type { CaptureDraft } from "../../models/CaptureDraft";
import type { RelevantPage } from "../../models/RelevantPage";
import type { CreatedTask } from "../../taskCreation/models/CreatedTask";
import type { BetterResearchResult } from "./BetterResearchResult";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface BetterResearchDraft {
  result: BetterResearchResult | null;
  tasks: CreatedTask[];
  captures: CaptureDraft[];
  pages: RelevantPage[];
}
