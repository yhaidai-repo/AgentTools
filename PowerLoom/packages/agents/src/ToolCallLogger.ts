import type { AgentEvent } from "@agenttools/runtime";
import type { DataAccessLog } from "./DataAccessLog";
import type { OutsideAccessContext } from "./models/OutsideAccessContext";
import { isOutsideTool } from "./outsideAccess";
import { classifyToolCall } from "./toolKinds";

type ToolCall = Extract<AgentEvent, { type: "tool_call" }>;
type ToolResult = Extract<AgentEvent, { type: "tool_result" }>;

// A failed result's text in the log, cut short.
const MAX_REASON_CHARS = 300;

// Logs every tool call of a run from its events, so a tool added tomorrow is tracked without any wiring (user decision
// 2026-10-13). The outside-read tools log themselves with more detail (resource, refused/denied, rows) and are skipped
// here, so no call is logged twice.
export class ToolCallLogger {
  private readonly pending = new Map<string, ToolCall>();

  constructor(
    private readonly log: DataAccessLog,
    private readonly context: OutsideAccessContext,
  ) {}

  async observe(event: AgentEvent): Promise<void> {
    if (event.type === "tool_call" && !isOutsideTool(event.name)) {
      this.pending.set(event.callId, event);
    }

    if (event.type === "tool_result") {
      await this.finish(event);
    }
  }

  // The run ended with calls that never got a result (aborted, timed out): logged as failed, so they're not lost.
  async flush(): Promise<void> {
    for (const call of this.pending.values()) {
      await this.record(call, "failed", "no result: the run ended", 0, new Date());
    }

    this.pending.clear();
  }

  private async finish(result: ToolResult): Promise<void> {
    const call = this.pending.get(result.callId);

    if (!call) {
      return;
    }

    this.pending.delete(result.callId);
    await this.record(call, result.isError ? "failed" : "ok", result.isError ? result.output.slice(0, MAX_REASON_CHARS) : null, Buffer.byteLength(result.output, "utf8"), result.at);
  }

  private record(call: ToolCall, outcome: "ok" | "failed", reason: string | null, bytes: number, endedAt: Date): Promise<void> {
    return this.log.record({
      ...this.context,
      ...classifyToolCall(call.name, call.input),
      tool: call.name,
      outcome,
      reason,
      rows: null,
      bytes,
      truncated: false,
      startedAt: call.at,
      durationMs: Math.max(0, endedAt.getTime() - call.at.getTime()),
    });
  }
}
