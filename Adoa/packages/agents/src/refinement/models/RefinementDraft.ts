import type { QuestionDraft } from "./QuestionDraft";
import type { RefinementOutput } from "./RefinementOutput";
import type { ResearchTaskDraft } from "./ResearchTaskDraft";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface RefinementDraft {
  refinement: RefinementOutput | null;
  researchTasks: ResearchTaskDraft[];
  questions: QuestionDraft[];
}
