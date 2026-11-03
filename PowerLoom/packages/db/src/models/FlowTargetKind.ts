// What a flow runs for: a PBI (`pbi_id`) or a task (`item_id`).
export const FLOW_TARGET_KINDS = ["pbi", "task"] as const;

export type FlowTargetKind = typeof FLOW_TARGET_KINDS[number];
