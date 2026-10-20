import type { CaseResult } from "./CaseResult";
import type { PlannedCase } from "./PlannedCase";
import type { TestFinding } from "./TestFinding";

export type TestReportStatus = "complete" | "partial" | "not_found" | "blocked";

// The Autotest agent's output for one task: the analysis of the acceptance criteria against the test cases, the plan
// and (from stage 3) the services and verdicts. Each successful run writes the next version.
export interface TestReport {
  goal: string;
  status: TestReportStatus;
  summary: string;
  analysis: TestFinding[];
  cases: PlannedCase[];
  /** The services the test needs on the stack, each with why. */
  services: { name: string; why: string }[];
  /** What running the cases showed; empty while nothing ran. */
  results: CaseResult[];
  /** Azure DevOps test cases to update by hand, one line each (the agent never writes ADO). */
  adoEdits: string[];
  nextReason: string;
}
