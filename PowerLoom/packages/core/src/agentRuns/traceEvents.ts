import type { StoredTraceEvent } from "@agenttools/usage";

// The event types a run's trace holds (AgentRunSession's phases, the agent's events, the recorder's bookkeeping).
export const TRACE_EVENT_KINDS = ["phase", "text", "tool_call", "tool_result", "usage", "result", "error", "rate_limit", "session_start", "session_progress", "session_end", "tool_progress"] as const;

type Payload = Record<string, any>;

// What the event is about: the tool's name for a call, else the type itself.
export function traceEventName(event: StoredTraceEvent): string {
  const payload = event.payload as Payload;

  if (event.type === "tool_call") {
    return String(payload.name);
  }

  if (event.type === "phase") {
    return String(payload.name ?? "phase");
  }

  return event.type;
}

// The event in one line of text, uncut; the web clips it for its trace view.
export function traceEventSummary(event: StoredTraceEvent): string {
  const payload = event.payload as Payload;

  switch (event.type) {
    case "tool_call":
      return JSON.stringify(payload.input);
    case "tool_result":
      return String(payload.output);
    case "usage":
      return `in ${payload.inputTokens} · out ${payload.outputTokens} · cache r ${payload.cacheReadTokens} / w ${payload.cacheWriteTokens}`;
    case "text":
      return String(payload.text);
    case "result":
      return `${payload.reason}, ${payload.turns} turns`;
    case "rate_limit":
      return [payload.status, ...(payload.windows ?? []).map((window: { window: string; utilization: number }) => `${window.window} ${Math.round(window.utilization * 100)}%`)].join(" · ");
    case "session_start":
      return `${payload.name ?? payload.kind}: ${payload.description}`;
    case "session_progress":
      return `${payload.totalTokens} tokens · ${payload.toolUses} tools${payload.lastToolName ? ` · ${payload.lastToolName}` : ""}`;
    case "session_end":
      return `${payload.status}${payload.summary ? `: ${payload.summary}` : ""}`;
    case "tool_progress":
      return [payload.name, `${Math.round(Number(payload.elapsedMs) / 1000)}s`, payload.detail].filter(Boolean).join(" · ");
    default:
      return payload.message ? String(payload.message) : "";
  }
}
