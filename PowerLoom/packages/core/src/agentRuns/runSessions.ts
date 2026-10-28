import type { StoredTraceEvent } from "@agenttools/usage";
import type { RunSession } from "../models/RunSession";
import type { RunSessionTrace } from "../models/RunSessionTrace";
import { RunSessionReader } from "./RunSessionReader";
import { MAIN_SESSION_ID } from "./sessionIds";

// The run page's session view (user decision 2026-10-28): a run's trace read into its main session and the sub-agents
// and background tasks it started. Pure, so the client trace view imports it by path.
export { MAIN_SESSION_ID, sessionIdOf } from "./sessionIds";

export function runSessionsOf(trace: StoredTraceEvent[], runEnded: boolean): RunSessionTrace {
  const reader = new RunSessionReader();

  trace.forEach((event) => reader.read(event));

  return reader.finish(runEnded);
}

// The sub-sessions a session's calls started, by the id of the call.
export function subSessionsByCall(sessions: RunSession[], parentId: string): Map<string, RunSession> {
  const children = sessions.filter((session) => session.parentId === parentId && session.callId !== null);

  return new Map(children.map((session) => [session.callId as string, session]));
}

export function sessionDurationMs(session: RunSession): number | null {
  if (session.usage.durationMs !== null) {
    return session.usage.durationMs;
  }

  return session.startedAt && session.endedAt ? session.endedAt.getTime() - session.startedAt.getTime() : null;
}

// The sub-session whose tool results first named the output (an item id, a note path); the main session when none did,
// since the host commits a run's outputs.
export function sessionOfOutput(trace: RunSessionTrace, output: string): string {
  const named = trace.sessions.find((session) => session.id !== MAIN_SESSION_ID && trace.events[session.id].some((event) => resultNames(event, output)));

  return named?.id ?? MAIN_SESSION_ID;
}

function resultNames(event: StoredTraceEvent, output: string): boolean {
  return event.type === "tool_result" && String(event.payload.output ?? "").includes(output);
}
