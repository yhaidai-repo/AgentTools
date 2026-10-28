// The model gets `reason` as the denied call's result.
export type ToolPolicyDecision = { allow: true } | { allow: false; reason: string };
