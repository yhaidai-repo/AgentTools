import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EventBody } from "../../EventSequence";
import type { RunEndReason } from "../../models/RunEndReason";
import { toNeutralToolName } from "./toSdkTools";
import { TurnUsageTracker } from "./TurnUsageTracker";

type AssistantMessage = Extract<SDKMessage, { type: "assistant" }>;
type UserMessage = Extract<SDKMessage, { type: "user" }>;
type RateLimitMessage = Extract<SDKMessage, { type: "rate_limit_event" }>;

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

  private mapRateLimit(message: RateLimitMessage): EventBody[] {
    const info = message.rate_limit_info;

    if (info.status === "allowed") {
      return [];
    }

    this.isRateLimited ||= info.status === "rejected";

    return [{
      type: "rate_limit",
      status: info.status === "rejected" ? "rejected" : "warning",
      resetsAt: info.resetsAt ? new Date(info.resetsAt * 1000) : null,
      utilization: info.utilization ?? null,
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

function toolResultText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content.map((part: { type?: string; text?: string }) => (part.type === "text" ? part.text ?? "" : `[${part.type}]`)).join("\n");
}
