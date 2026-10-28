import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EventBody } from "../../EventSequence";
import { fromEpochSeconds, windowsOfRateLimit } from "./claudeWindows";
import { RunResults } from "./RunResults";
import { SubSessions } from "./SubSessions";
import { toNeutralToolName } from "./toSdkTools";
import { TurnUsageTracker } from "./TurnUsageTracker";

type AssistantMessage = Extract<SDKMessage, { type: "assistant" }>;
type UserMessage = Extract<SDKMessage, { type: "user" }>;
type SystemMessage = Extract<SDKMessage, { type: "system" }>;
type ToolProgressMessage = Extract<SDKMessage, { type: "tool_progress" }>;
type RateLimitMessage = Extract<SDKMessage, { type: "rate_limit_event" }>;
type RateLimitInfo = RateLimitMessage["rate_limit_info"];

const RATE_LIMIT_STATUS: Record<RateLimitInfo["status"], "allowed" | "warning" | "rejected"> = {
  allowed: "allowed",
  allowed_warning: "warning",
  rejected: "rejected",
};

// A sub-agent's heartbeat names its Agent call with a counter suffix (`toolu_…-heartbeat-0`, spike 2026-10-28).
const HEARTBEAT_SUFFIX = /-heartbeat-\d+$/;

// Maps Claude Agent SDK messages to neutral events; other message kinds are ignored. The run's result comes from
// finish(), once the stream has ended.
export class MessageMapper {
  private readonly usage = new TurnUsageTracker();
  private readonly sessions = new SubSessions();
  private readonly results = new RunResults();
  private isRateLimited = false;

  map(message: SDKMessage): EventBody[] {
    switch (message.type) {
      case "assistant":
        return this.mapAssistant(message);
      case "user":
        return this.sessions.stamp(message.parent_tool_use_id, mapUser(message));
      case "tool_progress":
        return this.sessions.stamp(message.parent_tool_use_id, [mapToolProgress(message)]);
      case "system":
        return this.mapSystem(message);
      case "rate_limit_event":
        return this.mapRateLimit(message);
      case "result":
        return this.mapResult(message);
      default:
        return [];
    }
  }

  // Exactly one result per run, after the sub-sessions the stream left open.
  finish(stopReason: "timeout" | "aborted" | null): EventBody[] {
    return [...this.sessions.closeOpen(), this.results.toEvent(stopReason, this.isRateLimited)];
  }

  // A sub-agent frame's usage is a streaming snapshot, not its final count (about 1k output tokens summed against
  // 69k, spike 2026-10-28), so only main-session turns are tracked; sub-agents' tokens arrive with the result's totals.
  private mapAssistant(message: AssistantMessage): EventBody[] {
    const isMainSession = message.parent_tool_use_id === null;
    const finishedTurn = isMainSession ? this.usage.track(message) : [];

    this.isRateLimited ||= message.error === "rate_limit";

    return [...finishedTurn, ...this.sessions.stamp(message.parent_tool_use_id, message.message.content.flatMap(mapContentBlock))];
  }

  private mapSystem(message: SystemMessage): EventBody[] {
    switch (message.subtype) {
      case "task_started":
        return this.sessions.open(message);
      case "task_progress":
        return this.sessions.progress(message);
      case "task_notification":
        return this.sessions.close(message);
      default:
        return [];
    }
  }

  // Every status is passed on, so hosts can follow the subscription's usage, not only its warnings.
  private mapRateLimit(message: RateLimitMessage): EventBody[] {
    const info = message.rate_limit_info;

    this.isRateLimited ||= info.status === "rejected";

    return [{
      type: "rate_limit",
      status: RATE_LIMIT_STATUS[info.status],
      resetsAt: fromEpochSeconds(info.resetsAt),
      utilization: info.utilization ?? null,
      windows: windowsOfRateLimit(info),
    }];
  }

  private mapResult(message: SDKResultMessage): EventBody[] {
    this.results.add(message);

    return [...this.usage.flush(), ...this.usage.reconcile(message.modelUsage)];
  }
}

function mapContentBlock(block: AssistantMessage["message"]["content"][number]): EventBody[] {
  if (block.type === "text" && block.text.trim()) {
    return [{ type: "text", text: block.text }];
  }

  if (block.type === "tool_use") {
    return [{ type: "tool_call", callId: block.id, name: toNeutralToolName(block.name), input: block.input }];
  }

  return [];
}

function mapToolProgress(message: ToolProgressMessage): EventBody {
  return {
    type: "tool_progress",
    callId: message.tool_use_id.replace(HEARTBEAT_SUFFIX, ""),
    name: toNeutralToolName(message.tool_name),
    elapsedMs: message.elapsed_time_seconds * 1000,
  };
}

function mapUser(message: UserMessage): EventBody[] {
  const content = message.message.content;

  if (typeof content === "string") {
    return [];
  }

  return content
    .filter((block) => block.type === "tool_result")
    .map((block) => ({
      type: "tool_result" as const,
      callId: block.tool_use_id,
      isError: block.is_error ?? false,
      output: toolResultText(block.content),
    }));
}

export function toolResultText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content.map((part: { type?: string; text?: string }) => (part.type === "text" ? part.text ?? "" : `[${part.type}]`)).join("\n");
}
