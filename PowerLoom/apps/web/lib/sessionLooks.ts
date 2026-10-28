// The browser bundle must not pull core's barrel (see traceLooks): the session read model is imported by its path.
import { MAIN_SESSION_ID, sessionDurationMs, sessionOfOutput } from "@powerloom/core/src/agentRuns/runSessions";
import type { RunSession } from "@powerloom/core/src/models/RunSession";
import type { RunSessionStatus } from "@powerloom/core/src/models/RunSessionStatus";
import type { RunSessionTrace } from "@powerloom/core/src/models/RunSessionTrace";
import { formatDuration, formatTokens } from "@/lib/format";

// The dots of run outcomes (runOutcomes): pulsing while it runs, rose when it failed, amber when it ended early or its
// end never reached the trace.
const DOT_OF_STATUS: Record<RunSessionStatus, string> = { running: "running", completed: "ok", failed: "error", stopped: "warn", unfinished: "warn", lost: "warn" };

export function sessionDot(status: RunSessionStatus): string {
  return DOT_OF_STATUS[status];
}

export function sessionLabel(session: RunSession): string {
  if (session.id === MAIN_SESSION_ID) {
    return "main";
  }

  return session.name ?? (session.kind === "background_task" ? "background task" : "sub-agent");
}

// Status, duration, tokens and tool uses, as far as the trace told them.
export function sessionFacts(session: RunSession): string {
  const duration = sessionDurationMs(session);
  const facts = [
    session.status,
    duration === null ? null : formatDuration(duration),
    session.usage.totalTokens === null ? null : `${formatTokens(session.usage.totalTokens)} tokens`,
    session.usage.toolUses === null ? null : `${session.usage.toolUses} tools`,
    session.background ? "background" : null,
  ];

  return facts.filter((fact) => fact !== null).join(" · ");
}

// The sub-session that made each output, by its label; outputs of the main session are left out.
export function outputProducers(trace: RunSessionTrace, outputs: string[]): Record<string, string> {
  const labels = new Map(trace.sessions.map((session) => [session.id, sessionLabel(session)]));
  const made = outputs.map((output) => [output, sessionOfOutput(trace, output)] as const).filter(([, sessionId]) => sessionId !== MAIN_SESSION_ID);

  return Object.fromEntries(made.map(([output, sessionId]) => [output, labels.get(sessionId) ?? sessionId]));
}
