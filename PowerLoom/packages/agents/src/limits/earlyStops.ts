import type { RunOutcome } from "@agenttools/usage";
import type { ResultDraft } from "../result/models/ResultDraft";

type EarlyStop = "budget-exceeded" | "max-turns" | "timeout" | "aborted";

const STOPPED_BY: Record<EarlyStop, string> = {
  "budget-exceeded": "its budget",
  "max-turns": "its turn limit",
  timeout: "its time limit",
  aborted: "Stop in PowerLoom",
};

/** A run its own limits or the user's Stop ended: what it wrote so far is kept (status partial), not thrown away. */
export function isEarlyStop(outcome: RunOutcome): outcome is EarlyStop {
  return outcome in STOPPED_BY;
}

/** The result of a run stopped early before it called write_result: partial, with the agent's last words. */
export function stoppedResult(outcome: EarlyStop, lastWords: string): ResultDraft {
  const notes = lastWords ? `Its last notes:\n\n${lastWords}` : "It left no notes.";

  return { status: "partial", body: `Stopped by ${STOPPED_BY[outcome]} before it wrote a result.\n\n${notes}`, data: null, evidence: [], waitingFor: [] };
}
