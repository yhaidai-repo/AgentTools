import type { CSSProperties } from "react";
import type { RunSession } from "@powerloom/core/src/models/RunSession";
import Link from "next/link";
import { sessionDot, sessionFacts, sessionLabel } from "@/lib/sessionLooks";

interface SessionTreeProps {
  sessions: RunSession[];
  picked: string;
  continuesRunId: number | null;
  onPick: (sessionId: string) => void;
}

// The run's sessions as a tree, each with its status, duration and usage; a row picks the session the trace shows.
export function SessionTree({ sessions, picked, continuesRunId, onPick }: SessionTreeProps) {
  return (
    <div className="session-tree">
      {continuesRunId && <p className="session-continues">Continues <Link href={`/agents/runs/${continuesRunId}`}>RUN-{continuesRunId}</Link></p>}
      <nav aria-label="Sessions">
        {sessions.map((session) => (
          <button key={session.id} type="button" className={session.id === picked ? "session-row on" : "session-row"} style={{ "--depth": session.depth } as CSSProperties} aria-pressed={session.id === picked} title={session.description || undefined} onClick={() => onPick(session.id)}>
            <span className={`dot ${sessionDot(session.status)}`} />
            <span className="session-name">{sessionLabel(session)}</span>
            <span className="session-facts">{sessionFacts(session)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
