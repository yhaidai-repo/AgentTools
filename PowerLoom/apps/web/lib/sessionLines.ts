import type { StoredTraceEvent } from "@agenttools/usage";
import type { RunSession } from "@powerloom/core/src/models/RunSession";
import { groupPhases, matchesFilter, type TraceFilter } from "@/lib/traceLooks";
import type { SessionTraceLine } from "@/models/SessionTraceLine";
import type { TraceLine } from "@/models/TraceLine";

// A session's lines with each sub-session right after the call that started it; a sub-session whose call the filter
// hides comes last.
export function sessionLines(events: StoredTraceEvent[], children: Map<string, RunSession>, filter: TraceFilter): SessionTraceLine[] {
  const placed = new Set<string>();
  const lines = groupPhases(events.filter((event) => matchesFilter(event, filter))).flatMap((line) => withSubSession(line, children, placed));
  const unplaced = [...children.values()].filter((session) => !placed.has(session.id));

  return [...lines, ...unplaced.map(sessionLine)];
}

function withSubSession(line: TraceLine, children: Map<string, RunSession>, placed: Set<string>): SessionTraceLine[] {
  const session = line.kind === "event" && line.event.type === "tool_call" ? children.get(String(line.event.payload.callId)) : undefined;

  if (!session) {
    return [line];
  }

  placed.add(session.id);

  return [line, sessionLine(session)];
}

function sessionLine(session: RunSession): SessionTraceLine {
  return { kind: "session", key: `session-${session.id}`, session };
}
