// Who a hand-off goes to: an agent task (any agent handling its type takes it), or a person, as a human task or a question.
export const HANDOFF_TARGET_KINDS = ["agent", "human", "question"] as const;

export type HandoffTargetKind = typeof HANDOFF_TARGET_KINDS[number];
