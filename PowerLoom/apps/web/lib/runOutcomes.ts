import { isFailedOutcome } from "@powerloom/core";

// The Runs tab's outcome pills: a run is running, failed, or succeeded (success, no-op, stopped by the budget).
export const RUN_OUTCOME_GROUPS = [
  { key: "running", label: "Running" },
  { key: "failed", label: "Failed" },
  { key: "succeeded", label: "Succeeded" },
] as const;

export type RunOutcomeGroup = (typeof RUN_OUTCOME_GROUPS)[number]["key"];

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

export function outcomeGroupOf(outcome: string): RunOutcomeGroup {
  if (outcome === "running") {
    return "running";
  }

  return isFailedOutcome(outcome) ? "failed" : "succeeded";
}
