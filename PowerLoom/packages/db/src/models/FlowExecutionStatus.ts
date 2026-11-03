// How a flow execution stands: running until every node's task is closed (phase 2's engine), or the user cancelled it.
export const FLOW_EXECUTION_STATUSES = ["running", "done", "failed", "cancelled"] as const;

export type FlowExecutionStatus = typeof FLOW_EXECUTION_STATUSES[number];
