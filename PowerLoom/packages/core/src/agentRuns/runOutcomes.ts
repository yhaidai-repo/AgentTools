import type { RunOutcomeGroup } from "../models/RunOutcomeGroup";
import { isFailedOutcome } from "../runs";

// The Runs tab's outcome pills: a run is running, failed, or succeeded (success, no-op, stopped by the budget).
export const RUN_OUTCOME_GROUPS: { key: RunOutcomeGroup; label: string }[] = [
  { key: "running", label: "Running" },
  { key: "failed", label: "Failed" },
  { key: "succeeded", label: "Succeeded" },
];

export const RUN_OUTCOME_GROUP_KEYS = ["running", "failed", "succeeded"] as const;

export function outcomeGroupOf(outcome: string): RunOutcomeGroup {
  if (outcome === "running") {
    return "running";
  }

  return isFailedOutcome(outcome) ? "failed" : "succeeded";
}
