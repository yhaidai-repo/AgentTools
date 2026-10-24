import type { CaptureDraft } from "../../models/CaptureDraft";
import type { RelevantPage } from "../../models/RelevantPage";
import type { RefinementOutput } from "../../refinement/models/RefinementOutput";
import type { CreatedTask } from "../../taskCreation/models/CreatedTask";
import type { RefinementDetails } from "./RefinementDetails";

// Collected in memory during a run and written to the DB only if the run succeeds (or stops on its budget with it).
export interface BetterRefinementDraft {
  refinement: (RefinementOutput & { details: RefinementDetails }) | null;
  tasks: CreatedTask[];
  captures: CaptureDraft[];
  pages: RelevantPage[];
}
