// One case of the test plan: an acceptance criterion proven by a test case's steps, or by steps the agent wrote.
export interface PlannedCase {
  /** TC-<id> when it comes from an ADO test case; "agent" when the agent wrote it. */
  ref: string;
  title: string;
  criterion: string;
  steps: string[];
  data: string;
  expected: string;
  /** blocked: an open finding stops it; the task that unblocks it is named. */
  state: "planned" | "blocked";
  blockedBy: string | null;
}
