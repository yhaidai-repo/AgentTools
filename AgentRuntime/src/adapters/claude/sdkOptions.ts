import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRequest } from "../../models/AgentRequest";
import type { Conversation } from "../../models/Conversation";
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
    mcpServers: { [TOOL_SERVER_NAME]: createToolServer(request.tools) },
    allowedTools: [...sdkToolNames(request.tools), ...autoAllowedBuiltInTools(request.capabilities), ...projectSkillTools(request.settingSources)],
    permissionMode: permissionMode(request.capabilities),
    cwd,
    settingSources: request.settingSources ?? [],
    settings: { autoMemoryEnabled: false },
    env: { ...childEnv(process.env, CLIENT_APP, host.apiProxied), ...request.env },
    ...policyOptions(toolPolicies(request, cwd)),
    ...conversationOptions(host.conversation),
  };
}

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

function policyOptions(policies: ToolPolicy[]): Partial<Options> {
  return policies.length > 0 ? { hooks: toolPolicyHooks(allPolicies(policies)) } : {};
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
