"use client";

import { useState } from "react";
import { subSessionsByCall } from "@powerloom/core/src/agentRuns/runSessions";
import type { RunSession } from "@powerloom/core/src/models/RunSession";
import { sessionLines } from "@/lib/sessionLines";
import { sessionDot, sessionFacts, sessionLabel } from "@/lib/sessionLooks";
import type { SessionTraceLine } from "@/models/SessionTraceLine";
import type { SessionTraceSource } from "@/models/SessionTraceSource";
import { TraceLineView } from "./TraceView";

// One session's trace lines, each sub-session folded under the call that started it.
export function SessionLines({ sessionId, source }: { sessionId: string; source: SessionTraceSource }) {
  const events = source.events[sessionId];

  if (!events) {
    return <p className="hint">Loading…</p>;
  }

  const lines = sessionLines(events, subSessionsByCall(source.sessions, sessionId), source.filter);

  if (lines.length === 0) {
    return <p className="hint">No events.</p>;
  }

  return <>{lines.map((line) => <SessionLineView key={line.key} line={line} source={source} />)}</>;
}

function SessionLineView({ line, source }: { line: SessionTraceLine; source: SessionTraceSource }) {
  if (line.kind === "session") {
    return <SubSessionFold session={line.session} source={source} />;
  }

  return <TraceLineView line={line} />;
}

// Collapsed by default to one summary line; its events are drawn (and, in a large trace, loaded) once it opens.
function SubSessionFold({ session, source }: { session: RunSession; source: SessionTraceSource }) {
  const [isOpen, setOpen] = useState(false);

  function toggle(open: boolean): void {
    setOpen(open);

    if (open) {
      source.load(session.id);
    }
  }

  return (
    <details className="trace-session" open={isOpen} onToggle={(event) => toggle(event.currentTarget.open)}>
      <summary>
        <span className="fold-mark" aria-hidden="true">›</span>
        <span className={`dot ${sessionDot(session.status)}`} />
        <span className="trace-kind">{sessionLabel(session)}</span>
        <span className="trace-text">{session.description}{session.summary ? ` → ${session.summary}` : ""}</span>
        <span className="session-facts">{sessionFacts(session)}</span>
      </summary>
      {isOpen && <div className="trace-session-lines"><SessionLines sessionId={session.id} source={source} /></div>}
    </details>
  );
}
