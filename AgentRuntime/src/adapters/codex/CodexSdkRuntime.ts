import { Codex, type ThreadEvent } from "@openai/codex-sdk";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EventSequence, type EventBody } from "../../EventSequence";
import type { AgentEvent } from "../../models/AgentEvent";
import type { AgentRequest } from "../../models/AgentRequest";
import type { AgentRuntime } from "../../models/AgentRuntime";
import type { SubscriptionQuery } from "../../models/SubscriptionQuery";
import type { SubscriptionReport } from "../../models/SubscriptionReport";
import { RunAbort } from "../../RunAbort";
import { CodexConversations } from "./CodexConversations";
import { CodexEventMapper, isCodexRateLimit } from "./CodexEventMapper";
import { CodexRollouts } from "./CodexRollouts";
import { CodexUsageMeter } from "./CodexUsageMeter";
import { codexOptions, codexThreadOptions } from "./codexOptions";
import { CodexSubscription } from "./CodexSubscription";
import { codexToolNamer } from "./codexToolNames";
import { CodexToolServer } from "./CodexToolServer";
import type { CodexClientFactory } from "./models/CodexClientFactory";
import type { CodexRuntimeOptions } from "./models/CodexRuntimeOptions";

export class CodexSdkRuntime implements AgentRuntime {
  readonly provider = "openai-codex";
  readonly reportsSubscriptionInRuns = true;
  readonly conversations: CodexConversations | null;
  private readonly codexHome: string;
  private readonly subscription: CodexSubscription;
  private readonly rollouts: CodexRollouts;

  constructor(options: CodexRuntimeOptions, private readonly createClient: CodexClientFactory = (config) => new Codex(config)) {
    this.codexHome = resolve(options.codexHome);
    this.conversations = options.keepConversations ? new CodexConversations(this.codexHome) : null;
    this.subscription = new CodexSubscription(this.codexHome);
    this.rollouts = new CodexRollouts(this.codexHome);
  }

  async *run(request: AgentRequest): AsyncIterable<AgentEvent> {
    const sequence = new EventSequence(request.runId);
    const abort = new RunAbort(request.limits.timeoutMs, request.signal);
    const mapper = new CodexEventMapper(request.model.model);
    const meter = new CodexUsageMeter(this.rollouts, request.model.model);
    const started = Date.now();
    let directory: string | null = null;
    let server: CodexToolServer | null = null;
    let requested = false;

    try {
      abort.controller.signal.throwIfAborted();
      await mkdir(this.codexHome, { recursive: true });
      directory = await mkdtemp(join(tmpdir(), "powerloom-codex-"));
      server = await CodexToolServer.start(request.tools, abort.controller.signal);

      for await (const event of this.stream(request, directory, server, abort.controller.signal, meter, () => { requested = true; })) {
        yield* (await this.metered(event, mapper.map(event), mapper, meter)).map((body) => sequence.next(body));
        await this.remember(request, event);

        if (this.exceeded(request, mapper, abort)) {
          // Aborting stops new work; a terminal usage event already buffered by the SDK is still accounting evidence.
          continue;
        }

        yield* (await this.subscriptionEvents(event, mapper)).map((body) => sequence.next(body));
      }
    } catch (error) {
      yield* this.failure(error, mapper, abort).map((body) => sequence.next(body));
    } finally {
      abort.dispose(request.signal);
      await this.cleanup(server, directory);
    }

    // A run cut off before its turn completed: what the rollout counted since the last report.
    yield* (await meter.usage(mapper.threadId)).map((body) => sequence.next(body));
    yield sequence.next({
      type: "result",
      reason: abort.stopReason ?? mapper.reason,
      turns: mapper.turns,
      durationMs: Date.now() - started,
      providerCostUsd: null,
      message: mapper.message,
      usageComplete: !requested || mapper.usageComplete,
    });
  }

  async subscriptionUsage(_query: SubscriptionQuery = {}): Promise<SubscriptionReport> {
    return this.subscription.usage();
  }

  private async *stream(request: AgentRequest, directory: string, server: CodexToolServer, signal: AbortSignal, meter: CodexUsageMeter, onRequest: () => void): AsyncIterable<ThreadEvent> {
    const client = this.createClient(codexOptions(request, this.codexHome, server));
    const options = codexThreadOptions(request, directory);
    const resume = await this.resumedThread(request);

    await meter.begin(resume);
    const thread = resume ? client.resumeThread(resume, options) : client.startThread(options);

    signal.throwIfAborted();

    onRequest();
    const stream = await thread.runStreamed(codexToolNamer(request.tools)(request.firstMessage), { signal });

    for await (const event of stream.events) {
      if (event.type !== "turn.completed") signal.throwIfAborted();

      yield event;
    }
  }

  // Tokens as the run goes (the budget sees them), not only when its turn completes: after each tool call or message from
  // the rollout, and at the turn's end the rollout's remainder (or the turn's own usage when the rollout has none).
  private async metered(event: ThreadEvent, bodies: EventBody[], mapper: CodexEventMapper, meter: CodexUsageMeter): Promise<EventBody[]> {
    if (event.type === "turn.completed") {
      return [...bodies.filter((body) => body.type !== "usage"), ...(await meter.atTurnEnd(mapper.threadId, bodies.filter((body) => body.type === "usage")))];
    }

    if (event.type === "item.completed" && (event.item.type === "agent_message" || event.item.type === "mcp_tool_call")) {
      return [...bodies, ...(await meter.usage(mapper.threadId))];
    }

    return bodies;
  }

  private exceeded(request: AgentRequest, mapper: CodexEventMapper, abort: RunAbort): boolean {
    if (mapper.turns <= request.limits.maxTurns) {
      return false;
    }

    // Codex has no model-turn budget: each completed MCP call or agent message counts once.
    mapper.reason = "max-turns";
    mapper.message = "Completed tool calls and agent messages exceeded maxTurns.";
    abort.controller.abort("max-turns");

    return true;
  }

  private async subscriptionEvents(event: ThreadEvent, mapper: CodexEventMapper) {
    if (event.type !== "turn.completed" || !mapper.threadId) {
      return [];
    }

    return this.subscription.event(mapper.threadId);
  }

  private failure(error: unknown, mapper: CodexEventMapper, abort: RunAbort) {
    if (abort.controller.signal.aborted) {
      return [];
    }

    const message = error instanceof Error ? error.message : String(error);

    mapper.message = mapper.message ?? message;
    mapper.reason = isCodexRateLimit(message) ? "rate-limited" : "failed";

    return [{ type: "error" as const, message }];
  }

  private async resumedThread(request: AgentRequest): Promise<string | null> {
    if (!this.conversations || !request.conversation?.continues) {
      return null;
    }

    const thread = await this.conversations.threadOf(request.conversation.continues);

    if (!thread || !await this.conversations.exists(request.conversation.continues)) {
      throw new Error("The Codex conversation to continue was not found.");
    }

    return thread;
  }

  private async remember(request: AgentRequest, event: ThreadEvent): Promise<void> {
    if (event.type === "thread.started" && request.conversation && this.conversations) {
      await this.conversations.remember(request.conversation.id, event.thread_id);
    }
  }

  private async cleanup(server: CodexToolServer | null, directory: string | null): Promise<void> {
    await Promise.allSettled([server?.close(), directory ? rm(directory, { recursive: true, force: true }) : undefined]);
  }
}
