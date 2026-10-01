import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { EventSequence } from "../../EventSequence";
import type { AgentEvent } from "../../models/AgentEvent";
import type { AgentRequest } from "../../models/AgentRequest";
import type { AgentRuntime } from "../../models/AgentRuntime";
import type { SubscriptionQuery } from "../../models/SubscriptionQuery";
import type { SubscriptionReport } from "../../models/SubscriptionReport";
import { RunAbort } from "../../RunAbort";
import { probeWindows, readUsageCall, report } from "./claudeSubscription";
import { MessageMapper } from "./MessageMapper";
import { TOOL_SERVER_NAME, createToolServer, sdkToolNames } from "./toSdkTools";

const CLIENT_APP = "agenttools-runtime/1.0";
const WEB_TOOLS = ["WebSearch", "WebFetch"];

// Claude via the Claude Agent SDK, with every Claude Code built-in tool and setting source disabled:
// the agent sees only the request's tools, so it behaves the same as on any other adapter.
export class ClaudeAgentSdkRuntime implements AgentRuntime {
  readonly provider = "anthropic";
  readonly reportsSubscriptionInRuns = true;
  private lastSeen: SubscriptionReport | null = null;

  async *run(request: AgentRequest): AsyncIterable<AgentEvent> {
    const events = new EventSequence(request.runId);
    const abort = new RunAbort(request.limits.timeoutMs, request.signal);
    const mapper = new MessageMapper();

    try {
      for await (const event of streamEvents(request, abort, mapper, events)) {
        this.remember(event);
        yield event;
      }
    } catch (error) {
      yield events.next({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      abort.dispose(request.signal);
    }

    // An aborted or crashed run may end without a result message; every run still ends with exactly one.
    if (!mapper.hasResult) {
      yield events.next({ type: "result", reason: abort.stopReason ?? "failed", turns: 0, durationMs: 0, providerCostUsd: null, message: abort.stopReason });
    }
  }

  // The free /usage call first; then, when the host allows it, one probe request; then what the latest run reported.
  async subscriptionUsage(query: SubscriptionQuery = {}): Promise<SubscriptionReport> {
    const free = await readUsageCall();

    if (free.windows.length > 0) {
      return free;
    }

    const probed = query.probe ? await this.probe() : null;

    return probed ?? this.lastSeen ?? free;
  }

  private async probe(): Promise<SubscriptionReport> {
    try {
      const probed = report(null, await probeWindows(), "the probe request reported no windows");

      this.lastSeen = probed.windows.length > 0 ? probed : this.lastSeen;

      return probed;
    } catch (error) {
      return report(null, [], `the probe request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private remember(event: AgentEvent): void {
    if (event.type === "rate_limit" && event.windows.length > 0) {
      this.lastSeen = report(null, event.windows, null, event.at);
    }
  }
}

async function* streamEvents(request: AgentRequest, abort: RunAbort, mapper: MessageMapper, events: EventSequence): AsyncIterable<AgentEvent> {
  for await (const message of query({ prompt: request.firstMessage, options: buildOptions(request, abort) })) {
    yield* mapper.map(message).map((body) => events.next(body));
  }
}

// The webAccess capability maps to Claude's own web tools; every other built-in stays off.
function builtInTools(request: AgentRequest): string[] {
  return request.capabilities?.webAccess ? WEB_TOOLS : [];
}

function buildOptions(request: AgentRequest, abort: RunAbort): Options {
  return {
    model: request.model.model,
    effort: request.model.effort,
    systemPrompt: request.systemPrompt,
    maxTurns: request.limits.maxTurns,
    abortController: abort.controller,
    tools: builtInTools(request),
    mcpServers: { [TOOL_SERVER_NAME]: createToolServer(request.tools) },
    allowedTools: [...sdkToolNames(request.tools), ...builtInTools(request)],
    permissionMode: "dontAsk",
    settingSources: [],
    persistSession: false,
    env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: CLIENT_APP },
  };
}
