import type { QuestionDraft } from "../../refinement/models/QuestionDraft";
import type { ResearchTaskDraft } from "../../refinement/models/ResearchTaskDraft";
import type { CaptureDraft } from "../../models/CaptureDraft";
import type { HumanTaskDraft } from "./HumanTaskDraft";
import type { ResearchResultOutput } from "./ResearchResultOutput";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface ResearchDraft {
  result: ResearchResultOutput | null;
  followUps: ResearchTaskDraft[];
  humanTasks: HumanTaskDraft[];
  questions: QuestionDraft[];
  captures: CaptureDraft[];
}
