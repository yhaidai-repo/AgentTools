import type { PreToolUseHookInput, SyncHookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import type { ShellRoute } from "../../models/ShellRoute";
import { replayCommand } from "./shellRouteReplay";

// The only shell tool a Claude run is granted (builtInTools).
const ROUTED_TOOL = "Bash";

/** The hook's answer for a shell call the host's route ran: the call goes on with a command that replays the result.
 *  Null when the call isn't the route's; a route that fails denies the call, so the command never falls back to the
 *  run's own shell unchecked. */
export async function routedShellCall(input: PreToolUseHookInput, route: ShellRoute | null): Promise<SyncHookJSONOutput | null> {
  if (!route || input.tool_name !== ROUTED_TOOL) {
    return null;
  }

  const toolInput = (input.tool_input ?? {}) as Record<string, unknown>;

  try {
    const routed = await route.run(String(toolInput.command ?? ""), input.cwd, timeoutOf(toolInput));

    return routed ? replayed(toolInput, replayCommand(input.tool_use_id, routed)) : null;
  } catch (error) {
    return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `${ROUTED_TOOL} was blocked: the command could not run where the host routes it (${(error as Error).message}).` } };
  }
}

function replayed(toolInput: Record<string, unknown>, command: string): SyncHookJSONOutput {
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { ...toolInput, command } } };
}

function timeoutOf(toolInput: Record<string, unknown>): number | null {
  return typeof toolInput.timeout === "number" && toolInput.timeout > 0 ? toolInput.timeout : null;
}
