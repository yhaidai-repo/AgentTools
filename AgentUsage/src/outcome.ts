import type { RunOutcome } from "./models/RunOutcome";

const KNOWN: RunOutcome[] = ["success", "failed", "budget-exceeded", "rate-limited", "timeout", "aborted", "max-turns"];

// Outcomes that aren't failures: a budget stop is the budget doing its job, so totals count it apart from errors.
export const NOT_FAILED_OUTCOMES: RunOutcome[] = ["success", "budget-exceeded"];

export function isFailedOutcome(outcome: RunOutcome): boolean {
  return !NOT_FAILED_OUTCOMES.includes(outcome);
}

// Maps a runtime's end reason to an outcome; an abort caused by our own budget check counts as budget-exceeded.
export function toOutcome(reason: string, wasAbortedForBudget: boolean): RunOutcome {
  if (wasAbortedForBudget) {
    return "budget-exceeded";
  }

  return KNOWN.includes(reason as RunOutcome) ? (reason as RunOutcome) : "failed";
}
