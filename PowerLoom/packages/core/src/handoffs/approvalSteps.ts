import type { HumanTaskStep } from "../models/HumanTaskStep";

// A review human task's fixed answers (gate approve): the backend releases the tasks that depend on it only when step 1
// is answered `approve` (HandoffGates.cs in the backend reads the first answer); step 2 lets the person correct facts either way.
export const APPROVE_ANSWER = "approve";

export function approvalSteps(subject: string): HumanTaskStep[] {
  return [
    { action: `Review ${subject} and decide`, source: "other", resource: "The hand-off above", query: null, timeRange: null, reportBack: "`approve`, or `changes: <what to change>`" },
    { action: "Check the facts it rests on", source: "other", resource: "The hand-off above", query: null, timeRange: null, reportBack: "`ok`, or your corrections" },
  ];
}
