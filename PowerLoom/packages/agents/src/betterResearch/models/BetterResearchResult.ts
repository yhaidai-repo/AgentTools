import type { ResultStatus } from "../../models/ResultStatus";
import type { RelevantDoc } from "../../models/RelevantDoc";
import type { CodeRef } from "../../research/models/CodeRef";
import type { BugCause } from "./BugCause";
import type { NotFoundItem } from "./NotFoundItem";
import type { ResearchFinding } from "./ResearchFinding";
import type { SpikeOption } from "./SpikeOption";

// What write_research_result saves for Better Research.
export interface BetterResearchResult {
  question: string;
  conclusion: string;
  status: ResultStatus;
  findings: ResearchFinding[];
  bug: BugCause | null;
  options: SpikeOption[];
  notFound: NotFoundItem[];
  confidence: "high" | "medium" | "low";
  startPoints: CodeRef[];
  relevantDocs: RelevantDoc[];
  /** Why the run created its tasks, or why no next step is needed; the tasks themselves are in the draft. */
  nextReason: string;
}
