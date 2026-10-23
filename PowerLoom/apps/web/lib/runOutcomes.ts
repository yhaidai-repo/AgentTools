import { isFailedOutcome } from "@powerloom/core";

export { RUN_OUTCOME_GROUPS, outcomeGroupOf, type RunOutcomeGroup } from "@powerloom/core";

const BUDGET_STOP = "budget-exceeded";

// The dot of a run's outcome: pulsing while it runs, amber when its budget stopped it (neither done nor failed), rose
// when it failed, teal otherwise.
export function outcomeDot(outcome: string | null): string {
  if (outcome === "running") {
    return "running";
  }

  if (outcome === BUDGET_STOP) {
    return "warn";
  }

  return outcome && isFailedOutcome(outcome) ? "error" : "ok";
}
