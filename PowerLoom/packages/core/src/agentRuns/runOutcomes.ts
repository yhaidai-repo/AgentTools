import type { RunOutcomeGroup } from "../models/RunOutcomeGroup";
import { isFailedOutcome, isStoppedOutcome } from "../runs";

// The Runs tab's outcome pills: a run is running, failed, stopped (by its budget or by the user) or succeeded.
export const RUN_OUTCOME_GROUPS: { key: RunOutcomeGroup; label: string }[] = [
  { key: "running", label: "Running" },
  { key: "failed", label: "Failed" },
  { key: "stopped", label: "Stopped" },
  { key: "succeeded", label: "Succeeded" },
];

export const RUN_OUTCOME_GROUP_KEYS = ["running", "failed", "stopped", "succeeded"] as const;

export function outcomeGroupOf(outcome: string): RunOutcomeGroup {
  if (outcome === "running") {
    return "running";
  }

  if (isStoppedOutcome(outcome)) {
    return "stopped";
  }

  return isFailedOutcome(outcome) ? "failed" : "succeeded";
}
