import type { TestReport } from "./TestReport";

// The latest test report of a task, as the next run of the task continues from it.
export interface PreviousReport {
  /** The TR item's id: cited as the evidence of the verdicts it carries over. */
  id: string;
  report: TestReport;
}
