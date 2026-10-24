import type { Evidence } from "../../models/Evidence";

export type TestFindingKind = "missing_test_case" | "test_case_without_criterion" | "contradiction" | "missing_test_data" | "ambiguous_expectation" | "other";

// One gap the analysis found between the acceptance criteria, the test cases and the test data.
export interface TestFinding {
  kind: TestFindingKind;
  /** What it is about: "AC 3", "TC-1234", "AC 2 vs TC-1234". */
  about: string;
  detail: string;
  evidence: Evidence[];
  /** The task that resolves it (an id, or new:<n> for one created in this run), or why none is needed. */
  resolution: string;
}
