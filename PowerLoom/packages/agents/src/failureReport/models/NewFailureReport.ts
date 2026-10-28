import type { FailureImpact, FailureKind, FailureWorkaround } from "@powerloom/db";

// A failure as the agent reports it, plus who it is (from the run, never from the agent).
export interface NewFailureReport {
  vault: string;
  agentId: string;
  runId: number | null;
  taskId: string | null;
  pbiId: number | null;
  kind: FailureKind;
  tool: string | null;
  target: string;
  saw: string;
  workaround: FailureWorkaround;
  instead: string | null;
  impact: FailureImpact;
}
