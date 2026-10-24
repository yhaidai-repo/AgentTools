import type { QuestionDraft } from "../../refinement/models/QuestionDraft";
import type { ResearchTaskDraft } from "../../refinement/models/ResearchTaskDraft";
import type { CaptureDraft } from "../../models/CaptureDraft";
import type { HumanTaskSpec } from "../../humanTasks/models/HumanTaskSpec";
import type { ResearchResultOutput } from "./ResearchResultOutput";
import type { WebResearchDraft } from "../../models/WebResearchDraft";
import type { RelevantPage } from "../../models/RelevantPage";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface ResearchDraft {
  result: ResearchResultOutput | null;
  followUps: ResearchTaskDraft[];
  humanTasks: HumanTaskSpec[];
  questions: QuestionDraft[];
  captures: CaptureDraft[];
  webResearch: WebResearchDraft[];
  /** Useful Confluence pages for the later agents (write_research_result's relevant_pages). */
  pages: RelevantPage[];
}
