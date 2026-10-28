// What the agent did after the failure.
export const FAILURE_WORKAROUNDS = ["other_tool", "other_query", "continued_without", "stopped"] as const;

export type FailureWorkaround = typeof FAILURE_WORKAROUNDS[number];
