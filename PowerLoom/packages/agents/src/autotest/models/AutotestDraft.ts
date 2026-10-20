import type { CaptureDraft } from "../../models/CaptureDraft";
import type { BugDraft } from "./BugDraft";
import type { CreatedTask } from "../../taskCreation/models/CreatedTask";
import type { TestReport } from "./TestReport";

// Collected in memory during a run and written to the DB only if the run succeeds.
export interface AutotestDraft {
  report: TestReport | null;
  tasks: CreatedTask[];
  captures: CaptureDraft[];
  bugs: BugDraft[];
}
