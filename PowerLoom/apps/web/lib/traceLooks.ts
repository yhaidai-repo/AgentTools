import type { StoredTraceEvent } from "@agenttools/usage";
// The browser bundle (TraceView is a client component) must not pull core's barrel, which reaches the database driver;
// the summary is a pure module, so it is imported by its path.
import { traceEventSummary } from "@powerloom/core/src/agentRuns/traceEvents";
import type { TraceLine } from "@/models/TraceLine";
import type { TraceLook } from "@/models/TraceLook";

const SUMMARY_CHARS = 160;
const FOLDED_TYPES = new Set(["phase", "session_progress", "tool_progress"]);

export const TRACE_FILTERS = [
  { key: "all", label: "All" },
  { key: "calls", label: "Calls" },
  { key: "text", label: "Text" },
  { key: "errors", label: "Errors" },
] as const;

export type TraceFilter = (typeof TRACE_FILTERS)[number]["key"];

type Payload = Record<string, any>;

// Calls are cyan, results teal (rose when they failed), the agent's words violet, bookkeeping faint (user decision
// 2026-10-18).
export function eventLook(event: StoredTraceEvent): TraceLook {
  const payload = event.payload as Payload;

  switch (event.type) {
    case "tool_call":
      return { icon: "→", label: String(payload.name), className: "trace-call", open: false };
    case "tool_result":
      return payload.isError ? { icon: "!", label: "error", className: "trace-result nested failed", open: true } : { icon: "←", label: "result", className: "trace-result nested", open: false };
    case "text":
      return { icon: "¶", label: "text", className: "trace-said", open: false };
    case "result":
      return { icon: "✓", label: "end", className: "trace-end", open: true };
    case "error":
      return { icon: "!", label: "error", className: "trace-result failed", open: true };
    default:
      return { icon: "·", label: event.type.replace("_", " "), className: "trace-meta", open: false };
  }
}

export function matchesFilter(event: StoredTraceEvent, filter: TraceFilter): boolean {
  switch (filter) {
    case "calls":
      return event.type === "tool_call" || event.type === "tool_result";
    case "text":
      return event.type === "text" || event.type === "result";
    case "errors":
      return isError(event);
    default:
      return true;
  }
}

// Consecutive phase or progress events say little one by one: those of one type fold into one line.
export function groupPhases(events: StoredTraceEvent[]): TraceLine[] {
  const lines: TraceLine[] = [];

  for (const event of events) {
    addLine(lines, event);
  }

  return lines;
}

// An opened fold shows its events as the lines they would be unfolded.
export function unfoldPhases(events: StoredTraceEvent[]): TraceLine[] {
  return events.map(eventLine);
}

export function summaryOf(event: StoredTraceEvent): string {
  return clip(traceEventSummary(event));
}

function addLine(lines: TraceLine[], event: StoredTraceEvent): void {
  const last = lines.at(-1);

  if (!FOLDED_TYPES.has(event.type)) {
    lines.push(eventLine(event));

    return;
  }

  if (last?.kind === "phases" && last.events[0].type === event.type) {
    last.events.push(event);

    return;
  }

  lines.push({ kind: "phases", key: `phases-${event.seq}`, events: [event] });
}

function eventLine(event: StoredTraceEvent): TraceLine {
  return { kind: "event", key: String(event.seq), event };
}

function isError(event: StoredTraceEvent): boolean {
  return event.type === "error" || (event.type === "tool_result" && Boolean((event.payload as Payload).isError));
}

function clip(text: string): string {
  return text.length > SUMMARY_CHARS ? `${text.slice(0, SUMMARY_CHARS)}…` : text;
}
