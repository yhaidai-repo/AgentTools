import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { EventSequence } from "../../EventSequence";
import type { AgentEvent } from "../../models/AgentEvent";
import type { AgentRequest } from "../../models/AgentRequest";
import type { AgentRuntime } from "../../models/AgentRuntime";
import type { SubscriptionQuery } from "../../models/SubscriptionQuery";
import type { SubscriptionReport } from "../../models/SubscriptionReport";
import { RunAbort } from "../../RunAbort";
import { ClaudeConversations } from "./ClaudeConversations";
import { probeWindows, readUsageCall, report } from "./claudeSubscription";
import { MessageMapper } from "./MessageMapper";
import type { ClaudeRuntimeOptions } from "./models/ClaudeRuntimeOptions";
import { buildSdkOptions } from "./sdkOptions";
import { ToolReports } from "./ToolReports";
import { TOOL_SERVER_NAME, sdkToolNamer } from "./toSdkTools";
import { firstMessageAfter, waitForToolServer } from "./toolServerGate";

// Claude via the Claude Agent SDK (options: sdkOptions).
// `keepConversations`: runs with a conversation write their transcript under CLAUDE_CONFIG_DIR and can be continued.
export class ClaudeAgentSdkRuntime implements AgentRuntime {
  readonly provider = "anthropic";
  readonly reportsSubscriptionInRuns = true;
  readonly conversations: ClaudeConversations | null;
  private lastSeen: SubscriptionReport | null = null;
  private readonly projectDir = process.cwd();

  constructor(keepConversations = false, private readonly options: ClaudeRuntimeOptions = {}) {
    this.conversations = keepConversations ? new ClaudeConversations(this.projectDir) : null;
  }

  async *run(request: AgentRequest): AsyncIterable<AgentEvent> {
    const events = new EventSequence(request.runId);
    const abort = new RunAbort(request.limits.timeoutMs, request.signal);
    const mapper = new MessageMapper();
    const reports = new ToolReports();

    try {
      for await (const event of streamEvents(this.buildOptions(request, abort, reports), request, { mapper, reports, events })) {
        this.remember(event);
        yield event;
      }
    } catch (error) {
      yield events.next({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      abort.dispose(request.signal);
    }

    // The run ends with the stream, not with a result message; an aborted or crashed run still ends with one result.
    for (const body of mapper.finish(abort.stopReason)) {
      yield events.next(body);
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

  private buildOptions(request: AgentRequest, abort: RunAbort, toolReports: ToolReports): Options {
    const conversation = this.conversations ? request.conversation : undefined;

    return buildSdkOptions(request, abort, { projectDir: this.projectDir, conversation, apiProxied: this.options.apiProxied ?? false, toolReports });
  }

  private remember(event: AgentEvent): void {
    if (event.type === "rate_limit" && event.windows.length > 0) {
      this.lastSeen = report(null, event.windows, null, event.at);
    }
  }
}

// The first message waits for the tool server (toolServerGate) and names the tools as the model calls them
// (sdkToolNamer), so the model's first calls find every tool. The tools' own progress reports go out before each message.
async function* streamEvents(options: Options, request: AgentRequest, run: { mapper: MessageMapper; reports: ToolReports; events: EventSequence }): AsyncIterable<AgentEvent> {
  const { mapper, reports, events } = run;
  let serverReady: (status: string) => void = () => undefined;
  const ready = new Promise<string>((resolve) => { serverReady = resolve; });
  const firstMessage = sdkToolNamer(request.tools)(request.firstMessage);
  const session = query({ prompt: firstMessageAfter(ready, firstMessage), options });

  void waitForToolServer(session, TOOL_SERVER_NAME).then(serverReady);

  for await (const message of session) {
    yield* [...mapper.mapToolReports(reports.drain()), ...mapper.map(message)].map((body) => events.next(body));
  }
}
