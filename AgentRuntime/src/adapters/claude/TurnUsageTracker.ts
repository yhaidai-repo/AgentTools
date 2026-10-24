import type { ModelUsage, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EventBody } from "../../EventSequence";
import type { TurnUsageEvent } from "../../models/TurnUsageEvent";

type AssistantMessage = Extract<SDKMessage, { type: "assistant" }>;
type SdkUsage = NonNullable<AssistantMessage["message"]["usage"]>;
type TokenCounts = Pick<TurnUsageEvent, "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens">;

const TOKEN_FIELDS = ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"] as const;

// Turns SDK usage into per-turn usage events whose sum equals the SDK's own per-model totals.
// The SDK repeats a turn's message id per content block with partial usage, so the latest copy is kept
// and emitted when the next turn starts; at the end, whatever the turns missed is emitted as one correction.
export class TurnUsageTracker {
  private pending: { id: string; event: EventBody & TokenCounts & { model: string } } | null = null;
  private readonly emitted = new Map<string, TokenCounts>();

  track(message: AssistantMessage): EventBody[] {
    const { id, usage, model } = message.message;
    const finished = this.pending && this.pending.id !== id ? this.flush() : [];

    if (usage) {
      this.pending = { id, event: toUsageEvent(model, fromSdkUsage(usage)) };
    }

    return finished;
  }

  flush(): EventBody[] {
    const pending = this.pending;

    this.pending = null;

    if (!pending) {
      return [];
    }

    this.addEmitted(pending.event.model, pending.event);

    return [pending.event];
  }

  reconcile(modelUsage: Record<string, ModelUsage>): EventBody[] {
    return Object.entries(modelUsage).flatMap(([model, usage]) => this.correction(model, fromModelUsage(usage)));
  }

  private correction(model: string, total: TokenCounts): EventBody[] {
    const already = this.emitted.get(modelKey(model)) ?? zeroCounts();
    const missing = mapCounts((field) => Math.max(0, total[field] - already[field]));
    const hasMissing = TOKEN_FIELDS.some((field) => missing[field] > 0);

    return hasMissing ? [toUsageEvent(model, missing)] : [];
  }

  private addEmitted(model: string, counts: TokenCounts): void {
    const already = this.emitted.get(modelKey(model)) ?? zeroCounts();

    this.emitted.set(modelKey(model), mapCounts((field) => already[field] + counts[field]));
  }
}

// Per-turn messages name the dated model ("claude-haiku-4-5-20251001"), totals may not ("claude-haiku-4-5").
function modelKey(model: string): string {
  return model.replace(/-\d{8}$/, "");
}

function toUsageEvent(model: string, counts: TokenCounts): EventBody & TokenCounts & { model: string } {
  return { type: "usage", model, ...counts };
}

function fromSdkUsage(usage: SdkUsage): TokenCounts {
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

function fromModelUsage(usage: ModelUsage): TokenCounts {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadInputTokens,
    cacheWriteTokens: usage.cacheCreationInputTokens,
  };
}

function zeroCounts(): TokenCounts {
  return mapCounts(() => 0);
}

function mapCounts(value: (field: (typeof TOKEN_FIELDS)[number]) => number): TokenCounts {
  return Object.fromEntries(TOKEN_FIELDS.map((field) => [field, value(field)])) as TokenCounts;
}
