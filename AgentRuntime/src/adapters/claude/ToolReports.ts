import type { EventBody } from "../../EventSequence";
import type { ToolCallContext } from "../../models/ToolCallContext";

export type ToolProgressBody = Extract<EventBody, { type: "tool_progress" }>;

// Claude Code names the tool_use a call answers in the MCP request's _meta (CLI 2.1.286).
const TOOL_USE_ID_META = "claudecode/toolUseId";

const SILENT: ToolCallContext = { progress: () => undefined };

// What our tools report about their own running calls, held until the run's next SDK message: the run's events leave
// from the SDK stream only, and while a tool runs the SDK sends its heartbeat about every 30 s, so a report waits at most
// that long, and a call's last report goes out just before its result.
export class ToolReports {
  private pending: ToolProgressBody[] = [];

  /** The context of one call of tool `name`; `extra` is what the SDK's MCP server passed the handler. */
  contextFor(name: string, extra: unknown): ToolCallContext {
    const callId = toolUseIdOf(extra);
    const startedAt = Date.now();

    if (!callId) {
      return SILENT;
    }

    return { progress: (detail) => this.pending.push({ type: "tool_progress", callId, name, elapsedMs: Date.now() - startedAt, detail }) };
  }

  drain(): ToolProgressBody[] {
    const drained = this.pending;

    this.pending = [];

    return drained;
  }
}

function toolUseIdOf(extra: unknown): string | null {
  const meta = (extra as { _meta?: Record<string, unknown> } | undefined)?._meta;
  const id = meta?.[TOOL_USE_ID_META];

  return typeof id === "string" && id.length > 0 ? id : null;
}
