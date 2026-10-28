import type { ToolPolicy } from "../../models/ToolPolicy";
import type { ToolPolicyDecision } from "../../models/ToolPolicyDecision";

// Asks each policy in turn; the first denial is the decision.
export function allPolicies(policies: ToolPolicy[]): ToolPolicy {
  return async (call) => {
    for (const policy of policies) {
      const decision: ToolPolicyDecision = await policy(call);

      if (!decision.allow) {
        return decision;
      }
    }

    return { allow: true };
  };
}
