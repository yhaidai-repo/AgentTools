import type { QuestionDraft } from "./QuestionDraft";
import type { RefinementOutput } from "./RefinementOutput";
import type { ResearchTaskDraft } from "./ResearchTaskDraft";
import type { CaptureDraft } from "../../models/CaptureDraft";
import type { RelevantPage } from "../../models/RelevantPage";
import type { WebResearchDraft } from "../../models/WebResearchDraft";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface RefinementDraft {
  refinement: RefinementOutput | null;
  researchTasks: ResearchTaskDraft[];
  questions: QuestionDraft[];
  webResearch: WebResearchDraft[];
  /** Facts for the docs vault (e.g. from a Confluence page) the vault lacks; drafts once the run succeeds. */
  captures: CaptureDraft[];
  /** Useful Confluence pages for the later agents (write_refinement's relevant_pages). */
  pages: RelevantPage[];
}
