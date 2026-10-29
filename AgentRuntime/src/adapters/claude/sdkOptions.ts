import type { CanUseTool, Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRequest } from "../../models/AgentRequest";
import type { Conversation } from "../../models/Conversation";
import type { ShellRoute } from "../../models/ShellRoute";
import type { ToolPolicy } from "../../models/ToolPolicy";
import type { RunAbort } from "../../RunAbort";
import { allPolicies } from "./allPolicies";
import { autoAllowedBuiltInTools, builtInTools, permissionMode, projectSkillTools, writesUnattended } from "./builtInTools";
import { childEnv } from "./childEnv";
import type { SdkOptionsHost } from "./models/SdkOptionsHost";
import { secretsGuard } from "./secretsGuard";
import { TOOL_SERVER_NAME, createToolServer, sdkToolNamer, sdkToolNames, withSdkToolNaming } from "./toSdkTools";
import { toolPolicyHooks } from "./toolPolicyHook";
import { workspaceGuard } from "./workspaceGuard";

const CLIENT_APP = "agenttools-runtime/1.0";

// The SDK ends a run ten minutes after a turn's result unless the agent goes idle, and cancels everything still running:
// an orchestrator that ends its turn to wait for a background sub-agent (GSD's planner) lost every later call that way
// (pilot run 4364, 2026-10-29). The run's own timeout bounds that wait instead.
const BACKGROUND_WAIT_VARIABLE = "CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS";

// Every Claude Code built-in tool and setting source is off unless the request asks for it: the agent sees only the
// request's tools, so it behaves the same as on any other adapter.
// Auto-memory stays off: in a linked worktree it pointed at the main checkout's memory, the user's own (spike 2026-10-28).
export function buildSdkOptions(request: AgentRequest, abort: RunAbort, host: SdkOptionsHost): Options {
  const cwd = request.cwd ?? host.projectDir;

  return {
    model: request.model.model,
    effort: request.model.effort,
    systemPrompt: withSdkToolNaming(sdkToolNamer(request.tools)(request.systemPrompt), request.tools),
    maxTurns: request.limits.maxTurns,
    abortController: abort.controller,
    tools: [...builtInTools(request.capabilities), ...projectSkillTools(request.settingSources)],
    mcpServers: { [TOOL_SERVER_NAME]: createToolServer(request.tools, host.toolReports) },
    allowedTools: [...sdkToolNames(request.tools), ...autoAllowedBuiltInTools(request.capabilities), ...projectSkillTools(request.settingSources)],
    permissionMode: permissionMode(request.capabilities),
    cwd,
    settingSources: request.settingSources ?? [],
    settings: { autoMemoryEnabled: false },
    env: runEnv(request, host),
    canUseTool: unattendedPermission,
    ...policyOptions(toolPolicies(request, cwd), request.shellRoute ?? null),
    ...conversationOptions(host.conversation),
  };
}

function runEnv(request: AgentRequest, host: SdkOptionsHost): Record<string, string | undefined> {
  return { ...childEnv(process.env, CLIENT_APP, host.apiProxied), ...request.env, [BACKGROUND_WAIT_VARIABLE]: String(request.limits.timeoutMs) };
}

// No one answers a permission prompt in an unattended run. Without this callback the SDK fails the prompt and the agent
// reads "The user doesn't want to take this action right now. STOP…", which it takes as an order to stop the whole run.
const unattendedPermission: CanUseTool = async (toolName, _input, options) => {
  const reason = options.decisionReason ? ` (${options.decisionReason})` : "";

  return { behavior: "deny", message: `${toolName} needs a permission this unattended run cannot grant${reason}. Carry on with the tools and files the run allows; do not stop.` };
};

// A run with built-in tools always gets the secrets guard, one that writes also the guard of its folder; the
// request's own policy comes on top of them, never instead.
function toolPolicies(request: AgentRequest, cwd: string): ToolPolicy[] {
  const hasBuiltInTools = builtInTools(request.capabilities).length > 0;
  const guards = [
    ...(hasBuiltInTools ? [secretsGuard] : []),
    ...(writesUnattended(request.capabilities) ? [workspaceGuard(cwd)] : []),
  ];

  return request.toolPolicy ? [...guards, request.toolPolicy] : guards;
}

// A shell route needs the hook even for a run with no policy: it hands the commands over there.
function policyOptions(policies: ToolPolicy[], route: ShellRoute | null): Partial<Options> {
  return policies.length > 0 || route ? { hooks: toolPolicyHooks(allPolicies(policies), route) } : {};
}

// A continued conversation is forked into the run's own id, so the earlier run's transcript stays as it was.
function conversationOptions(conversation: Conversation | undefined): Partial<Options> {
  if (!conversation) {
    return { persistSession: false };
  }

  if (!conversation.continues) {
    return { persistSession: true, sessionId: conversation.id };
  }

  return { persistSession: true, resume: conversation.continues, forkSession: true, sessionId: conversation.id };
}
