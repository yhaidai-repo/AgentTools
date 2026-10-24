import type { Evidence } from "../../models/Evidence";

// A bug the agent found while running a case; written to PowerLoom only when the run succeeds.
export interface BugDraft {
  title: string;
  criterion: string;
  case: string;
  steps: string[];
  expected: string;
  actual: string;
  evidence: Evidence[];
  artifacts: string[];
  suspectedCause: string | null;
  priority: number | null;
}
