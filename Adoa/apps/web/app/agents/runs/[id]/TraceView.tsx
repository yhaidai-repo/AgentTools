import type { StoredTraceEvent } from "@agenttools/usage";
import { LocalTime } from "@/components/LocalTime";

// Collapsible timeline of a run's events; long payloads are already truncated by AgentUsage.
export function TraceView({ events }: { events: StoredTraceEvent[] }) {
  if (events.length === 0) {
    return <p className="muted">No trace (older than the retention period, or the run had no events).</p>;
  }

  return (
    <ol className="trace">
      {events.map((event) => (
        <li key={event.seq} className={`trace-${event.type}`}>
          <details open={event.type === "text" || event.type === "result" || event.type === "error"}>
            <summary>
              <span className="muted">#{event.seq} <LocalTime date={event.at} timeOnly /></span> <strong>{event.type}</strong> {summaryOf(event)}
            </summary>
            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
          </details>
        </li>
      ))}
    </ol>
  );
}

function summaryOf(event: StoredTraceEvent): string {
  const payload = event.payload as Record<string, any>;

  switch (event.type) {
    case "tool_call":
      return `${payload.name} ${JSON.stringify(payload.input).slice(0, 120)}`;
    case "tool_result":
      return `${payload.isError ? "error: " : ""}${String(payload.output).slice(0, 120)}`;
    case "usage":
      return `in ${payload.inputTokens} · out ${payload.outputTokens} · cache r ${payload.cacheReadTokens} / w ${payload.cacheWriteTokens}`;
    case "text":
      return String(payload.text).slice(0, 120);
    case "result":
      return `${payload.reason}, ${payload.turns} turns`;
    case "rate_limit":
      return [payload.status, ...(payload.windows ?? []).map((window: { window: string; utilization: number }) => `${window.window} ${Math.round(window.utilization * 100)}%`)].join(" · ");
    default:
      return payload.message ? String(payload.message).slice(0, 120) : "";
  }
}
