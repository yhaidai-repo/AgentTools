// What a hand-off asks of its target (user decision 2026-10-28: one hand-off feature for every agent): `continue` the
// target carries the work on and the sender is done; `ask` the sender waits for the target's answer and runs again;
// `review` a person reviews the sender's output and the tasks that depend on the review are gated by it; `return` the
// work goes back upstream (e.g. to planning after a review asked for changes) and the sender is done.
export const HANDOFF_INTENTS = ["continue", "ask", "review", "return"] as const;

export type HandoffIntent = typeof HANDOFF_INTENTS[number];
