import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EventBody } from "../../EventSequence";
import type { RunEndReason } from "../../models/RunEndReason";

// A `result` message ends one turn loop of the main session, not the run: with a background sub-agent the SDK sent
// four while the sub-agent kept working (spike 2026-10-28). The run's one result is built when the stream ends, from
// the last of them; `num_turns` and `duration_ms` count per loop, `total_cost_usd` is already the session's total.
export class RunResults {
  private last: SDKResultMessage | null = null;
  private turns = 0;
  private durationMs = 0;

  add(message: SDKResultMessage): void {
    this.last = message;
    this.turns += message.num_turns;
    this.durationMs += message.duration_ms;
  }

  toEvent(stopReason: "timeout" | "aborted" | null, isRateLimited: boolean): EventBody {
    return {
      type: "result",
      reason: this.reason(stopReason, isRateLimited),
      turns: this.turns,
      durationMs: this.durationMs,
      providerCostUsd: this.last?.total_cost_usd ?? null,
      message: this.message(stopReason),
    };
  }

  private reason(stopReason: "timeout" | "aborted" | null, isRateLimited: boolean): RunEndReason {
    if (stopReason) {
      return stopReason;
    }

    if (!this.last) {
      return "failed";
    }

    if (isRateLimited) {
      return "rate-limited";
    }

    if (this.last.subtype === "error_max_turns") {
      return "max-turns";
    }

    return this.last.subtype === "success" && !this.last.is_error ? "success" : "failed";
  }

  private message(stopReason: "timeout" | "aborted" | null): string | null {
    if (stopReason || !this.last) {
      return stopReason;
    }

    return this.last.subtype === "success" ? null : this.last.errors.join("; ") || this.last.subtype;
  }
}
