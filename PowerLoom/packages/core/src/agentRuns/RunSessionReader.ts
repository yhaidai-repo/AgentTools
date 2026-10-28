import type { StoredTraceEvent } from "@agenttools/usage";
import type { RunSession } from "../models/RunSession";
import type { RunSessionKind } from "../models/RunSessionKind";
import type { RunSessionStatus } from "../models/RunSessionStatus";
import type { RunSessionTrace } from "../models/RunSessionTrace";
import { MAIN_SESSION_ID, sessionIdOf } from "./sessionIds";

type Payload = Record<string, any>;

const MAIN_STATUS_OF_REASON: Record<string, RunSessionStatus> = { success: "completed", aborted: "stopped" };

// Reads a run's trace event by event into its sessions. The runtime opens a sub-session from its first frame when that
// frame came before the session's start message (`inferred`), and the complete start replaces it; an event of a session
// the trace never started still gets a session, under the main one.
export class RunSessionReader {
  private readonly sessions = new Map<string, RunSession>();
  private readonly events: Record<string, StoredTraceEvent[]> = {};
  private readonly completeStarts = new Set<string>();
  private readonly ended = new Set<string>();
  private readonly toolCalls = new Map<string, number>();

  constructor() {
    this.add(newSession(MAIN_SESSION_ID, null, "main"));
  }

  read(event: StoredTraceEvent): void {
    const session = this.sessionFor(sessionIdOf(event));

    session.startedAt ??= event.at;
    session.eventCount += 1;
    this.events[session.id].push(event);
    this.apply(session, event);
  }

  finish(runEnded: boolean): RunSessionTrace {
    const sessions = [...this.sessions.values()];

    sessions.forEach((session) => this.settle(session, runEnded));

    return { sessions: treeOrder(sessions), events: this.events };
  }

  private apply(session: RunSession, event: StoredTraceEvent): void {
    const payload = event.payload as Payload;

    switch (event.type) {
      case "session_start":
        this.start(session, payload);
        return;
      case "session_progress":
        this.progress(session, payload);
        return;
      case "session_end":
        this.end(session, event.at, payload);
        return;
      case "result":
        this.endMain(session, event.at, payload);
        return;
      case "tool_call":
        this.toolCalls.set(session.id, (this.toolCalls.get(session.id) ?? 0) + 1);
        return;
    }
  }

  private start(session: RunSession, payload: Payload): void {
    if (payload.inferred && this.completeStarts.has(session.id)) {
      return;
    }

    if (!payload.inferred) {
      this.completeStarts.add(session.id);
    }

    session.parentId = payload.parentSessionId ?? MAIN_SESSION_ID;
    session.kind = payload.kind ?? session.kind;
    session.name = payload.name ?? session.name;
    session.description = payload.description || session.description;
    session.background = payload.background ?? session.background;
  }

  // Running totals; the end's totals are final.
  private progress(session: RunSession, payload: Payload): void {
    if (this.ended.has(session.id)) {
      return;
    }

    session.usage = { totalTokens: payload.totalTokens ?? null, toolUses: payload.toolUses ?? null, durationMs: payload.durationMs ?? null };
  }

  private end(session: RunSession, at: Date, payload: Payload): void {
    this.ended.add(session.id);
    session.endedAt = at;
    session.status = payload.status ?? "completed";
    session.summary = payload.summary ?? null;
    session.usage = {
      totalTokens: payload.totalTokens ?? session.usage.totalTokens,
      toolUses: payload.toolUses ?? session.usage.toolUses,
      durationMs: payload.durationMs ?? session.usage.durationMs,
    };
  }

  // The run's one result ends the main session.
  private endMain(session: RunSession, at: Date, payload: Payload): void {
    this.ended.add(session.id);
    session.endedAt = at;
    session.status = MAIN_STATUS_OF_REASON[payload.reason] ?? "failed";
    session.summary = payload.message ?? null;
    session.usage.durationMs = payload.durationMs ?? null;
  }

  // A session without an end runs on while the run does; after the run its end was lost (or the run failed before it).
  private settle(session: RunSession, runEnded: boolean): void {
    session.usage.toolUses ??= this.toolCalls.get(session.id) ?? 0;

    if (this.ended.has(session.id)) {
      return;
    }

    if (!runEnded) {
      session.status = "running";

      return;
    }

    session.status = this.events[session.id].some((event) => event.type === "error") ? "failed" : "lost";
    session.endedAt = this.events[session.id].at(-1)?.at ?? null;
  }

  private sessionFor(id: string): RunSession {
    return this.sessions.get(id) ?? this.add(newSession(id, MAIN_SESSION_ID, "subagent"));
  }

  private add(session: RunSession): RunSession {
    this.sessions.set(session.id, session);
    this.events[session.id] = [];

    return session;
  }
}

function newSession(id: string, parentId: string | null, kind: RunSessionKind): RunSession {
  return {
    id,
    parentId,
    callId: parentId === null ? null : id,
    kind,
    name: null,
    description: "",
    background: null,
    depth: 0,
    startedAt: null,
    endedAt: null,
    status: "running",
    summary: null,
    usage: { totalTokens: null, toolUses: null, durationMs: null },
    eventCount: 0,
  };
}

// Main first, each session followed by its own sub-sessions in the order they started. A session whose parent the trace
// never named (or a loop of parents) hangs under the main session.
function treeOrder(sessions: RunSession[]): RunSession[] {
  const ordered: RunSession[] = [];
  const [main, ...rest] = sessions;

  appendSubtree(ordered, sessions, main, 0);

  let orphan = rest.find((session) => !ordered.includes(session));

  while (orphan) {
    orphan.parentId = main.id;
    appendSubtree(ordered, sessions, orphan, 1);
    orphan = rest.find((session) => !ordered.includes(session));
  }

  return ordered;
}

function appendSubtree(ordered: RunSession[], sessions: RunSession[], session: RunSession, depth: number): void {
  session.depth = depth;
  ordered.push(session);

  for (const child of sessions.filter((other) => other.parentId === session.id && !ordered.includes(other))) {
    appendSubtree(ordered, sessions, child, depth + 1);
  }
}
