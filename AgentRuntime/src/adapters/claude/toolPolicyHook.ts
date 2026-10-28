import type { HookCallback, HookCallbackMatcher, HookEvent, PreToolUseHookInput, SyncHookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import type { ToolPolicy } from "../../models/ToolPolicy";
import type { ToolPolicyCall } from "../../models/ToolPolicyCall";
import { toNeutralToolName } from "./toSdkTools";

// Sub-agents' tool calls never reach canUseTool (0 of 12 in the spike, 2026-10-28), but the PreToolUse hook sees every
// call, with the calling sub-agent's agent_id and agent_type. The hook only denies: an allowed call goes on through
// the run's own permission rules.
export function toolPolicyHooks(policy: ToolPolicy): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  return { PreToolUse: [{ hooks: [toolPolicyHook(policy)] }] };
}

export function toolPolicyHook(policy: ToolPolicy): HookCallback {
  return async (input) => {
    if (input.hook_event_name !== "PreToolUse") {
      return {};
    }

    const decision = await policy(toPolicyCall(input));

    return decision.allow ? {} : denied(decision.reason);
  };
}

function toPolicyCall(input: PreToolUseHookInput): ToolPolicyCall {
  return {
    callId: input.tool_use_id,
    name: toNeutralToolName(input.tool_name),
    input: input.tool_input,
    taskId: input.agent_id ?? null,
    agentType: input.agent_id ? input.agent_type ?? null : null,
  };
}

function denied(reason: string): SyncHookJSONOutput {
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } };
}
