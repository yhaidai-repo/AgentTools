import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StoredTraceEvent } from "@agenttools/usage";
import { MAIN_SESSION_ID, runSessionsOf, subSessionsByCall } from "@powerloom/core/src/agentRuns/runSessions";
import { sessionLines } from "./sessionLines";

function event(seq: number, type: string, payload: Record<string, unknown> = {}): StoredTraceEvent {
  return { runId: "7", seq, at: new Date(seq * 1000), type, payload };
}

describe("sessionLines", () => {
  const trace = [
    event(1, "tool_call", { name: "Agent", callId: "call-1" }),
    event(2, "session_start", { sessionId: "call-1", parentSessionId: null, kind: "subagent", name: "gsd-planner", description: "Plan", inferred: false }),
    event(3, "session_progress", { sessionId: "call-1", totalTokens: 10, toolUses: 0, durationMs: 1 }),
    event(4, "session_progress", { sessionId: "call-1", totalTokens: 20, toolUses: 1, durationMs: 2 }),
    event(5, "tool_result", { callId: "call-1", output: "done" }),
    event(6, "text", { text: "finished" }),
  ];
  const read = runSessionsOf(trace, true);
  const children = subSessionsByCall(read.sessions, MAIN_SESSION_ID);

  it("puts a sub-session right after the call that started it", () => {
    const lines = sessionLines(read.events[MAIN_SESSION_ID], children, "all");

    assert.deepEqual(lines.map((line) => line.kind), ["event", "session", "event", "event"]);
  });

  it("puts a sub-session whose call the filter hides last", () => {
    const lines = sessionLines(read.events[MAIN_SESSION_ID], children, "text");

    assert.deepEqual(lines.map((line) => line.kind), ["event", "session"]);
  });

  it("folds a sub-session's progress events into one line", () => {
    const lines = sessionLines(read.events["call-1"], new Map(), "all");

    assert.deepEqual(lines.map((line) => line.kind), ["event", "phases"]);
  });
});
