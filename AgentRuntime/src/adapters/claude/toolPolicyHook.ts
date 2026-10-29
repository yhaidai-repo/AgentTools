import type { HookCallback, HookCallbackMatcher, HookEvent, PreToolUseHookInput, SyncHookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import type { ShellRoute } from "../../models/ShellRoute";
import type { ToolPolicy } from "../../models/ToolPolicy";
import type { ToolPolicyCall } from "../../models/ToolPolicyCall";
import { routedShellCall } from "./shellRouteHook";
import { toNeutralToolName } from "./toSdkTools";

// A routed command waits in the hook for its whole run (a sync, a restore and a build or test of up to ten minutes).
const ROUTE_TIMEOUT_SECONDS = 45 * 60;

// Sub-agents' tool calls never reach canUseTool (0 of 12 in the spike, 2026-10-28), but the PreToolUse hook sees every
// call, with the calling sub-agent's agent_id and agent_type. The hook only denies, or hands a shell command to the
// host's route (ShellRoute) before the policy sees it: an allowed call goes on through the run's own permission rules.
// One hook does both, in that order: the SDK runs separate hooks side by side and lets any denial win.
export function toolPolicyHooks(policy: ToolPolicy, route: ShellRoute | null = null): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  const timeout = route ? { timeout: ROUTE_TIMEOUT_SECONDS } : {};

  return { PreToolUse: [{ hooks: [toolPolicyHook(policy, route)], ...timeout }] };
}

export function toolPolicyHook(policy: ToolPolicy, route: ShellRoute | null = null): HookCallback {
  return async (input) => {
    if (input.hook_event_name !== "PreToolUse") {
      return {};
    }

    const routed = await routedShellCall(input, route);

    if (routed) {
      return routed;
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
