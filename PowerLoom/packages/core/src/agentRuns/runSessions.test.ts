import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StoredTraceEvent } from "@agenttools/usage";
import { MAIN_SESSION_ID, runSessionsOf, sessionDurationMs, sessionOfOutput, subSessionsByCall } from "./runSessions";

let seq = 0;

function event(type: string, payload: Record<string, unknown> = {}, second = seq): StoredTraceEvent {
  seq += 1;

  return { runId: "7", seq, at: new Date(second * 1000), type, payload };
}

function started(sessionId: string, extra: Record<string, unknown> = {}): StoredTraceEvent {
  return event("session_start", { sessionId, parentSessionId: null, kind: "subagent", name: "gsd-planner", description: "Plan", taskId: "t1", background: false, inferred: false, ...extra });
}

describe("runSessionsOf", () => {
  it("reads a run without sub-sessions into its main session alone, with every event", () => {
    const trace = [event("phase", { name: "prepare" }), event("tool_call", { name: "read", callId: "c1" }), event("tool_result", { callId: "c1", output: "ok" }), event("result", { reason: "success", turns: 2, durationMs: 4000 })];

    const read = runSessionsOf(trace, true);

    assert.deepEqual(read.sessions.map((session) => session.id), [MAIN_SESSION_ID]);
    assert.equal(read.events[MAIN_SESSION_ID].length, 4);
    assert.equal(read.sessions[0].status, "completed");
    assert.equal(read.sessions[0].usage.toolUses, 1);
    assert.equal(sessionDurationMs(read.sessions[0]), 4000);
  });

  it("hangs a sub-agent under the Agent call that started it, with its own events and end totals", () => {
    const trace = [
      event("tool_call", { name: "Agent", callId: "call-1" }, 1),
      started("call-1"),
      event("text", { sessionId: "call-1", text: "planning" }),
      event("session_progress", { sessionId: "call-1", totalTokens: 100, toolUses: 1, durationMs: 1000 }),
      event("session_end", { sessionId: "call-1", status: "completed", summary: "Planned", totalTokens: 900, toolUses: 4, durationMs: 5000 }, 6),
      event("tool_result", { callId: "call-1", output: "plan written" }),
    ];

    const read = runSessionsOf(trace, false);
    const sub = read.sessions[1];

    assert.equal(sub.parentId, MAIN_SESSION_ID);
    assert.equal(sub.callId, "call-1");
    assert.equal(sub.name, "gsd-planner");
    assert.equal(sub.depth, 1);
    assert.equal(sub.status, "completed");
    assert.equal(sub.summary, "Planned");
    assert.deepEqual(sub.usage, { totalTokens: 900, toolUses: 4, durationMs: 5000 });
    assert.deepEqual(read.events["call-1"].map((item) => item.type), ["session_start", "text", "session_progress", "session_end"]);
    assert.deepEqual(read.events[MAIN_SESSION_ID].map((item) => item.type), ["tool_call", "tool_result"]);
    assert.equal(read.sessions[0].status, "running");
    assert.equal(subSessionsByCall(read.sessions, MAIN_SESSION_ID).get("call-1"), sub);
  });

  it("keeps a frame that came before its session_start and lets the complete start replace an inferred one", () => {
    const trace = [
      event("text", { sessionId: "call-2", text: "early" }),
      started("call-2", { inferred: true, name: null, background: null, taskId: null }),
      started("call-2", { name: "gsd-executor", background: true }),
      started("call-2", { inferred: true, name: "stale" }),
    ];

    const read = runSessionsOf(trace, false);
    const sub = read.sessions[1];

    assert.equal(read.sessions.length, 2);
    assert.equal(sub.name, "gsd-executor");
    assert.equal(sub.background, true);
    assert.equal(sub.eventCount, 4);
  });

  it("nests sessions by parent, in the order they started", () => {
    const trace = [started("a"), started("b"), started("a1", { parentSessionId: "a" }), started("a1x", { parentSessionId: "a1" })];

    const read = runSessionsOf(trace, false);

    assert.deepEqual(read.sessions.map((session) => [session.id, session.depth]), [[MAIN_SESSION_ID, 0], ["a", 1], ["a1", 2], ["a1x", 3], ["b", 1]]);
  });

  it("hangs a session whose parent the trace never named under the main session", () => {
    const read = runSessionsOf([started("x", { parentSessionId: "unknown" })], false);

    assert.equal(read.sessions[1].parentId, MAIN_SESSION_ID);
    assert.equal(read.sessions[1].depth, 1);
  });

  it("tells a session still running from one whose end the ended run lost, and keeps its last running totals", () => {
    const trace = [started("bg", { kind: "background_task", name: null }), event("session_progress", { sessionId: "bg", totalTokens: 50, toolUses: 2, durationMs: 800 }, 3)];

    assert.equal(runSessionsOf(trace, false).sessions[1].status, "running");

    const lost = runSessionsOf(trace, true).sessions[1];

    assert.equal(lost.status, "lost");
    assert.equal(lost.kind, "background_task");
    assert.deepEqual(lost.usage, { totalTokens: 50, toolUses: 2, durationMs: 800 });
    assert.equal(lost.endedAt?.getTime(), 3000);
  });

  it("keeps a long tool call's own heartbeat in the session that made the call, not as a sub-agent (traces before 2026-10-29)", () => {
    const trace = [
      event("tool_call", { name: "sandbox_restore", callId: "call-r" }, 1),
      event("session_start", { sessionId: "call-r", parentSessionId: null, kind: "subagent", name: null, description: "", taskId: null, background: null, inferred: true }),
      event("tool_progress", { sessionId: "call-r", callId: "call-r", name: "sandbox_restore", elapsedMs: 29_000 }),
      event("tool_result", { callId: "call-r", output: "Restored" }),
    ];

    const read = runSessionsOf(trace, false);

    assert.deepEqual(read.sessions.map((session) => [session.id, session.kind, session.parentId]), [[MAIN_SESSION_ID, "main", null]]);
    assert.deepEqual(read.events[MAIN_SESSION_ID].map((stored) => stored.type), ["tool_call", "session_start", "tool_progress", "tool_result"]);
  });

  it("marks the main session failed when the run failed before any result", () => {
    const read = runSessionsOf([event("phase", { name: "prepare" }), event("error", { message: "no repo" })], true);

    assert.equal(read.sessions[0].status, "failed");
  });
});

describe("sessionOfOutput", () => {
  it("names the sub-session whose tool result named the output, else the main session", () => {
    const read = runSessionsOf([started("w"), event("tool_result", { sessionId: "w", output: "created TT-1-002" })], true);

    assert.equal(sessionOfOutput(read, "TT-1-002"), "w");
    assert.equal(sessionOfOutput(read, "TT-1-009"), MAIN_SESSION_ID);
  });
});
