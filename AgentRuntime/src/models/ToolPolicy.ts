import type { ToolPolicyCall } from "./ToolPolicyCall";
import type { ToolPolicyDecision } from "./ToolPolicyDecision";

// Checked before every tool call, sub-agents' calls included. It can only deny: an allowed call still goes through
// the adapter's own permission rules.
export type ToolPolicy = (call: ToolPolicyCall) => ToolPolicyDecision | Promise<ToolPolicyDecision>;
