import type { RunOutcome } from "@agenttools/usage";
import type { ResultDraft } from "../result/models/ResultDraft";

type LimitStop = "budget-exceeded" | "max-turns" | "timeout";

const STOPPED_BY: Record<LimitStop, string> = {
  "budget-exceeded": "its budget",
  "max-turns": "its turn limit",
  timeout: "its time limit",
};

/** A run its own limits stopped: what it wrote so far is kept (status partial), not thrown away with the run. */
export function isLimitStop(outcome: RunOutcome): outcome is LimitStop {
  return outcome in STOPPED_BY;
}

/** The result of a run a limit stopped before it called write_result: partial, with the agent's last words. */
export function stoppedResult(outcome: LimitStop, lastWords: string): ResultDraft {
  const notes = lastWords ? `Its last notes:\n\n${lastWords}` : "It left no notes.";

  return { status: "partial", body: `Stopped by ${STOPPED_BY[outcome]} before it wrote a result.\n\n${notes}`, data: null, evidence: [], waitingFor: [] };
}
