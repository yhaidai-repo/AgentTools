import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EventBody } from "../../EventSequence";
import type { RunEndReason } from "../../models/RunEndReason";
import { fromEpochSeconds, windowsOfRateLimit } from "./claudeWindows";
import { toNeutralToolName } from "./toSdkTools";
import { TurnUsageTracker } from "./TurnUsageTracker";

type AssistantMessage = Extract<SDKMessage, { type: "assistant" }>;
type UserMessage = Extract<SDKMessage, { type: "user" }>;
type RateLimitMessage = Extract<SDKMessage, { type: "rate_limit_event" }>;
type RateLimitInfo = RateLimitMessage["rate_limit_info"];

const RATE_LIMIT_STATUS: Record<RateLimitInfo["status"], "allowed" | "warning" | "rejected"> = {
  allowed: "allowed",
  allowed_warning: "warning",
  rejected: "rejected",
};

// Maps Claude Agent SDK messages to neutral events; other message kinds are ignored.
export class MessageMapper {
  private readonly usage = new TurnUsageTracker();
  private isRateLimited = false;
  private isResultMapped = false;

  get hasResult(): boolean {
    return this.isResultMapped;
  }

  map(message: SDKMessage): EventBody[] {
    switch (message.type) {
      case "assistant":
        return this.mapAssistant(message);
      case "user":
        return mapUser(message);
      case "rate_limit_event":
        return this.mapRateLimit(message);
      case "result":
        return [...this.usage.flush(), ...this.usage.reconcile(message.modelUsage), this.mapResult(message)];
      default:
        return [];
    }
  }

  private mapAssistant(message: AssistantMessage): EventBody[] {
    const finishedTurn = this.usage.track(message);

    this.isRateLimited ||= message.error === "rate_limit";

    return [...finishedTurn, ...message.message.content.flatMap(mapContentBlock)];
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

  private mapResult(message: SDKResultMessage): EventBody {
    this.isResultMapped = true;

    return {
      type: "result",
      reason: this.resultReason(message),
      turns: message.num_turns,
      durationMs: message.duration_ms,
      providerCostUsd: message.total_cost_usd ?? null,
      message: message.subtype === "success" ? null : message.errors.join("; ") || message.subtype,
    };
  }

  private resultReason(message: SDKResultMessage): RunEndReason {
    if (this.isRateLimited) {
      return "rate-limited";
    }

    if (message.subtype === "error_max_turns") {
      return "max-turns";
    }

    return message.subtype === "success" && !message.is_error ? "success" : "failed";
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
