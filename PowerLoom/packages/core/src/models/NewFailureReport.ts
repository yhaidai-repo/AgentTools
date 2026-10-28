import type { FailureImpact, FailureKind, FailureWorkaround } from "@powerloom/db";

// A failure as an agent or a chat reports it, plus who it is (from the run or the chat session, never from the reporter).
export interface NewFailureReport {
  vault: string;
  origin: "run" | "chat";
  agentId: string;
  /** Who reported, for a chat. */
  actor: string | null;
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
