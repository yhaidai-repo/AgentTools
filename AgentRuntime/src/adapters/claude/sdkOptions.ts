import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRequest } from "../../models/AgentRequest";
import type { Conversation } from "../../models/Conversation";
import type { ToolPolicy } from "../../models/ToolPolicy";
import type { RunAbort } from "../../RunAbort";
import { childEnv } from "./childEnv";
import type { SdkOptionsHost } from "./models/SdkOptionsHost";
import { secretsGuard } from "./secretsGuard";
import { TOOL_SERVER_NAME, createToolServer, sdkToolNamer, sdkToolNames, withSdkToolNaming } from "./toSdkTools";
import { toolPolicyHooks } from "./toolPolicyHook";

const CLIENT_APP = "agenttools-runtime/1.0";
const WEB_TOOLS = ["WebSearch", "WebFetch"];

// Every Claude Code built-in tool and setting source is off unless the request asks for it: the agent sees only the
// request's tools, so it behaves the same as on any other adapter.
// Auto-memory stays off: in a linked worktree it pointed at the main checkout's memory, the user's own (spike 2026-10-28).
export function buildSdkOptions(request: AgentRequest, abort: RunAbort, host: SdkOptionsHost): Options {
  return {
    model: request.model.model,
    effort: request.model.effort,
    systemPrompt: withSdkToolNaming(sdkToolNamer(request.tools)(request.systemPrompt), request.tools),
    maxTurns: request.limits.maxTurns,
    abortController: abort.controller,
    tools: builtInTools(request),
    mcpServers: { [TOOL_SERVER_NAME]: createToolServer(request.tools) },
    allowedTools: [...sdkToolNames(request.tools), ...builtInTools(request)],
    permissionMode: "dontAsk",
    cwd: request.cwd ?? host.projectDir,
    settingSources: request.settingSources ?? [],
    settings: { autoMemoryEnabled: false },
    env: childEnv(process.env, CLIENT_APP, host.apiProxied),
    ...policyOptions(toolPolicy(request)),
    ...conversationOptions(host.conversation),
  };
}

// The webAccess capability maps to Claude's own web tools; every other built-in stays off.
function builtInTools(request: AgentRequest): string[] {
  return request.capabilities?.webAccess ? WEB_TOOLS : [];
}

// A run with built-in tools gets the secrets guard unless the request brings its own policy.
function toolPolicy(request: AgentRequest): ToolPolicy | undefined {
  if (request.toolPolicy) {
    return request.toolPolicy;
  }

  return builtInTools(request).length > 0 ? secretsGuard : undefined;
}

function policyOptions(policy: ToolPolicy | undefined): Partial<Options> {
  return policy ? { hooks: toolPolicyHooks(policy) } : {};
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
