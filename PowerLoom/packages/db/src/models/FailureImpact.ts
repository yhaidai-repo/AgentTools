// How the failure changes the agent's result.
export const FAILURE_IMPACTS = ["none", "weaker_evidence", "gap_in_result", "blocked"] as const;

export type FailureImpact = typeof FAILURE_IMPACTS[number];
