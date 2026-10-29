"use client";

import { useState } from "react";
import type { StoredTraceEvent } from "@agenttools/usage";
import { LocalTime } from "@/components/LocalTime";
import { TRACE_FILTERS, eventLook, groupPhases, latestDetail, matchesFilter, summaryOf, unfoldPhases, type TraceFilter } from "@/lib/traceLooks";
import type { TraceLine } from "@/models/TraceLine";

// A run's events as lines that wrap (user decision 2026-10-18): each kind its icon and colour, a result nested under
// its call, repeated phase events folded into one line, and pills to see only calls, text or errors. A line opens its
// full payload; long payloads are already truncated by AgentUsage.
export function TraceView({ events }: { events: StoredTraceEvent[] }) {
  const [filter, setFilter] = useState<TraceFilter>("all");

  if (events.length === 0) {
    return <p className="hint">No trace (older than the retention period, or the run had no events).</p>;
  }

  const lines = groupPhases(events.filter((event) => matchesFilter(event, filter)));

  return (
    <>
      <TraceFilterPills events={events} filter={filter} onChange={setFilter} />
      <div className="trace-lines">
        {lines.map((line) => <TraceLineView key={line.key} line={line} />)}
      </div>
    </>
  );
}

export function TraceFilterPills({ events, filter, onChange }: { events: StoredTraceEvent[]; filter: TraceFilter; onChange: (filter: TraceFilter) => void }) {
  return (
    <nav className="status-pills trace-pills" aria-label="Show">
      {TRACE_FILTERS.map((choice) => (
        <button key={choice.key} type="button" className={choice.key === filter ? "status-pill on" : "status-pill"} onClick={() => onChange(choice.key)}>
          {choice.label}<b>{events.filter((event) => matchesFilter(event, choice.key)).length}</b>
        </button>
      ))}
    </nav>
  );
}

export function TraceLineView({ line }: { line: TraceLine }) {
  if (line.kind === "phases") {
    return <PhasesFold events={line.events} />;
  }

  const look = eventLook(line.event);

  return (
    <details className={`trace-line ${look.className}`} open={look.open}>
      <summary>
        <span className="trace-icon" aria-hidden="true">{look.icon}</span>
        <span className="trace-time"><LocalTime date={line.event.at} timeOnly /></span>
        <span className="trace-kind">{look.label}</span>
        <span className="trace-text">{summaryOf(line.event)}</span>
      </summary>
      <pre className="trace-payload">{JSON.stringify(line.event.payload, null, 2)}</pre>
    </details>
  );
}

// Folded events are drawn only once the fold opens: a long run can fold thousands of progress events into one line.
// A fold of a long tool call's progress shows what the tool last reported.
function PhasesFold({ events }: { events: StoredTraceEvent[] }) {
  const [isOpen, setOpen] = useState(false);
  const detail = latestDetail(events);

  return (
    <details className="trace-group" open={isOpen} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="fold-mark" aria-hidden="true">›</span>
        <span>{events.length} {events[0].type.replace("_", " ")} events</span>
        {detail && <span className="trace-text">{detail}</span>}
      </summary>
      {isOpen && unfoldPhases(events).map((line) => <TraceLineView key={line.key} line={line} />)}
    </details>
  );
}
