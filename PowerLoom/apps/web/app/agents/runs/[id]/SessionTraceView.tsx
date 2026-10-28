"use client";

import { useMemo, useState } from "react";
import type { StoredTraceEvent } from "@agenttools/usage";
import { MAIN_SESSION_ID } from "@powerloom/core/src/agentRuns/runSessions";
import type { RunSession } from "@powerloom/core/src/models/RunSession";
import type { TraceFilter } from "@/lib/traceLooks";
import type { SessionTraceSource } from "@/models/SessionTraceSource";
import type { TraceMode } from "@/models/TraceMode";
import { loadRunEvents } from "./actions";
import { SessionLines } from "./SessionLines";
import { SessionTree } from "./SessionTree";
import { TraceFilterPills, TraceView } from "./TraceView";

const MODES: { key: TraceMode; label: string }[] = [{ key: "sessions", label: "Sessions" }, { key: "flat", label: "Flat" }];

interface SessionTraceViewProps {
  runId: number;
  sessions: RunSession[];
  /** Each session's events; only the main session's when the trace is large (`complete` false), the rest load when opened. */
  events: Record<string, StoredTraceEvent[]>;
  complete: boolean;
  continuesRunId: number | null;
}

// A run with sub-sessions (user decision 2026-10-28): its session tree, which picks the session the trace shows, and that
// session's trace with each sub-session folded under the Agent call that started it. Flat keeps the whole trace as one
// list, as before.
export function SessionTraceView({ runId, sessions, events, complete, continuesRunId }: SessionTraceViewProps) {
  const [mode, setMode] = useState<TraceMode>("sessions");
  const [picked, setPicked] = useState(MAIN_SESSION_ID);
  const [filter, setFilter] = useState<TraceFilter>("all");
  const [loaded, setLoaded] = useState<Record<string, StoredTraceEvent[]>>({});
  const [loadedTrace, setLoadedTrace] = useState<StoredTraceEvent[] | null>(null);
  const shown: Record<string, StoredTraceEvent[] | undefined> = { ...loaded, ...events };
  const wholeTrace = useMemo(() => Object.values(events).flat().sort((a, b) => a.seq - b.seq), [events]);

  function load(sessionId: string): void {
    if (shown[sessionId]) {
      return;
    }

    void loadRunEvents(runId, sessionId).then((sessionEvents) => setLoaded((previous) => ({ ...previous, [sessionId]: sessionEvents })));
  }

  function pick(sessionId: string): void {
    setPicked(sessionId);
    load(sessionId);
  }

  function show(next: TraceMode): void {
    setMode(next);

    if (next === "flat" && !complete && !loadedTrace) {
      void loadRunEvents(runId).then(setLoadedTrace);
    }
  }

  const source: SessionTraceSource = { sessions, events: shown, filter, load };

  return (
    <>
      <nav className="status-pills trace-pills" aria-label="View">
        {MODES.map((choice) => <button key={choice.key} type="button" className={choice.key === mode ? "status-pill on" : "status-pill"} onClick={() => show(choice.key)}>{choice.label}</button>)}
      </nav>
      {mode === "flat" && <FlatTrace events={complete ? wholeTrace : loadedTrace} />}
      {mode === "sessions" && (
        <>
          <SessionTree sessions={sessions} picked={picked} continuesRunId={continuesRunId} onPick={pick} />
          <TraceFilterPills events={shown[picked] ?? []} filter={filter} onChange={setFilter} />
          <div className="trace-lines"><SessionLines sessionId={picked} source={source} /></div>
        </>
      )}
    </>
  );
}

function FlatTrace({ events }: { events: StoredTraceEvent[] | null }) {
  if (!events) {
    return <p className="hint">Loading…</p>;
  }

  return <TraceView events={events} />;
}
