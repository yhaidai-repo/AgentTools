// What the implementation agent does with its task, read from the plan review it waited for and the PBI (user decision
// 2026-10-29): build the approved plan, hand the review's changes (or a changed PBI) back to planning, or stop for a person.
export type ReviewOutcome =
  | { kind: "approved"; reviewId: string; planVersion: number }
  | { kind: "replan"; reviewId: string | null; reason: string; corrections: string }
  | { kind: "blocked"; reason: string };
