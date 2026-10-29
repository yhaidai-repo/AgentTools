import { USER_STOP_OUTCOME, isFailedOutcome } from "@powerloom/core";
import type { RunEndPanel } from "@/models/RunEndPanel";

export { RUN_OUTCOME_GROUPS, outcomeGroupOf, type RunOutcomeGroup } from "@powerloom/core";

const BUDGET_STOP = "budget-exceeded";

// The dot of a run's outcome: pulsing while it runs, amber when its budget stopped it (neither done nor failed), grey
// and still when the user stopped it (ended as asked), rose when it failed, teal otherwise.
export function outcomeDot(outcome: string | null): string {
  if (outcome === "running") {
    return "running";
  }

  if (outcome === BUDGET_STOP) {
    return "warn";
  }

  if (outcome === USER_STOP_OUTCOME) {
    return "off";
  }

  return outcome && isFailedOutcome(outcome) ? "error" : "ok";
}

// The panel beside a run's trace that says how it ended: a neutral one when the user stopped it, the failure when it
// failed, none otherwise.
export function runEndPanel(outcome: string): RunEndPanel | null {
  if (outcome === USER_STOP_OUTCOME) {
    return { title: "Stopped", tone: null };
  }

  return isFailedOutcome(outcome) ? { title: "Failure", tone: "error" } : null;
}
