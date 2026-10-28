// What releases the tasks that depend on a hand-off's target: `approve` only a human task closed done with `approve` as
// its first answer; `answer` only an answered question or a done human task; `none` any close, cancel and dismiss included.
export const HANDOFF_GATES = ["approve", "answer", "none"] as const;

export type HandoffGate = typeof HANDOFF_GATES[number];
