import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRequest } from "../../models/AgentRequest";
import type { Conversation } from "../../models/Conversation";
import type { RunAbort } from "../../RunAbort";
import { childEnv } from "./childEnv";
import { TOOL_SERVER_NAME, createToolServer, sdkToolNamer, sdkToolNames, withSdkToolNaming } from "./toSdkTools";
import { toolPolicyHooks } from "./toolPolicyHook";

const CLIENT_APP = "agenttools-runtime/1.0";
const WEB_TOOLS = ["WebSearch", "WebFetch"];

// Every Claude Code built-in tool and setting source is off unless the request asks for it: the agent sees only the
// request's tools, so it behaves the same as on any other adapter. `projectDir` is the folder of a run without its own.
// Auto-memory stays off: in a linked worktree it pointed at the main checkout's memory, the user's own (spike 2026-10-28).
export function buildSdkOptions(request: AgentRequest, abort: RunAbort, projectDir: string, conversation: Conversation | undefined): Options {
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
    cwd: request.cwd ?? projectDir,
    settingSources: request.settingSources ?? [],
    settings: { autoMemoryEnabled: false },
    env: childEnv(process.env, CLIENT_APP),
    ...policyOptions(request),
    ...conversationOptions(conversation),
  };
}

// The webAccess capability maps to Claude's own web tools; every other built-in stays off.
function builtInTools(request: AgentRequest): string[] {
  return request.capabilities?.webAccess ? WEB_TOOLS : [];
}

function policyOptions(request: AgentRequest): Partial<Options> {
  return request.toolPolicy ? { hooks: toolPolicyHooks(request.toolPolicy) } : {};
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
