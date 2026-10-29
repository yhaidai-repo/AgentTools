import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EventBody } from "../../EventSequence";
import { fromEpochSeconds, windowsOfRateLimit } from "./claudeWindows";
import type { SdkAssistantMessage } from "./models/SdkAssistantMessage";
import type { SdkRateLimitInfo } from "./models/SdkRateLimitInfo";
import type { SdkRateLimitMessage } from "./models/SdkRateLimitMessage";
import type { SdkSystemMessage } from "./models/SdkSystemMessage";
import type { SdkToolProgressMessage } from "./models/SdkToolProgressMessage";
import type { SdkUserMessage } from "./models/SdkUserMessage";
import { RunResults } from "./RunResults";
import { SubSessions } from "./SubSessions";
import type { ToolProgressBody } from "./ToolReports";
import { SUBAGENT_TOOL, toNeutralToolName } from "./toSdkTools";
import { TurnUsageTracker } from "./TurnUsageTracker";

const RATE_LIMIT_STATUS: Record<SdkRateLimitInfo["status"], "allowed" | "warning" | "rejected"> = {
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
        return this.sessions.stamp(message, mapUser(message));
      case "tool_progress":
        return this.mapToolProgress(message);
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

  /** Our tools' own progress reports (ToolReports), each in the session of the call it reports on. */
  mapToolReports(reports: ToolProgressBody[]): EventBody[] {
    return reports.flatMap((report) => this.sessions.stampCall(report));
  }

  // Exactly one result per run, after the usage of a turn the stop cut short and the sub-sessions the stream left open.
  finish(stopReason: "timeout" | "aborted" | null): EventBody[] {
    return [...this.usage.flush(), ...this.sessions.closeOpen(), this.results.toEvent(stopReason, this.isRateLimited)];
  }

  // A sub-agent frame's usage is a streaming snapshot, not its final count (about 1k output tokens summed against
  // 69k, spike 2026-10-28), so only main-session turns are tracked; sub-agents' tokens arrive with the result's totals.
  private mapAssistant(message: SdkAssistantMessage): EventBody[] {
    const isMainSession = message.parent_tool_use_id === null;
    const finishedTurn = isMainSession ? this.usage.track(message) : [];

    this.isRateLimited ||= message.error === "rate_limit";

    return [...finishedTurn, ...this.contentEvents(message)];
  }

  private contentEvents(message: SdkAssistantMessage): EventBody[] {
    const bodies = message.message.content.flatMap(mapContentBlock);

    return this.sessions.stamp(message, bodies);
  }

  private mapToolProgress(message: SdkToolProgressMessage): EventBody[] {
    const progress = toolProgressOf(message);

    return isOwnHeartbeat(message, progress) ? this.sessions.stampCall(progress) : this.sessions.stamp(message, [progress]);
  }

  private mapSystem(message: SdkSystemMessage): EventBody[] {
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
  private mapRateLimit(message: SdkRateLimitMessage): EventBody[] {
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

function mapContentBlock(block: SdkAssistantMessage["message"]["content"][number]): EventBody[] {
  if (block.type === "text" && block.text.trim()) {
    return [{ type: "text", text: block.text }];
  }

  if (block.type === "tool_use") {
    return [{ type: "tool_call", callId: block.id, name: toNeutralToolName(block.name), input: block.input }];
  }

  return [];
}

function toolProgressOf(message: SdkToolProgressMessage): ToolProgressBody {
  return {
    type: "tool_progress",
    callId: message.tool_use_id.replace(HEARTBEAT_SUFFIX, ""),
    name: toNeutralToolName(message.tool_name),
    elapsedMs: message.elapsed_time_seconds * 1000,
  };
}

// The SDK names a tool's own call as the parent of that call's heartbeat (run 4414's sandbox_restore, CLI 2.1.286),
// which read as a sub-agent of the call. Only the sub-agent tool's heartbeat belongs to the session its call started.
function isOwnHeartbeat(message: SdkToolProgressMessage, progress: ToolProgressBody): boolean {
  return message.parent_tool_use_id === progress.callId && progress.name !== SUBAGENT_TOOL;
}

function mapUser(message: SdkUserMessage): EventBody[] {
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
