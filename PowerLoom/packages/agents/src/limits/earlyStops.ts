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

/** Turns or time ran out, or Stop (user decision 2026-10-26): only the result is kept, as a checkpoint; what the run
 *  staged isn't committed. A budget stop commits everything (user decision 2026-10-13). */
export function keepsOnlyResult(outcome: RunOutcome): boolean {
  return outcome === "max-turns" || outcome === "timeout" || outcome === "aborted";
}

/** The result of a run stopped early before it called write_result: partial, with the agent's last words. */
export function stoppedResult(outcome: EarlyStop, lastWords: string): ResultDraft {
  const notes = lastWords ? `Its last notes:\n\n${lastWords}` : "It left no notes.";

  return { status: "partial", body: `Stopped by ${STOPPED_BY[outcome]} before it wrote a result.\n\n${notes}`, data: null, evidence: [], waitingFor: [] };
}
