import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EventBody } from "../../EventSequence";
import { MessageMapper } from "./MessageMapper";

// Frames shaped as SDK 0.3.286 sent them in the GSD spike (traces/2-new-project-*.jsonl), cut to the fields the mapper reads.
const AGENT_CALL = "toolu_agent";
const BASH_CALL = "toolu_bash";
const RESTORE_CALL = "toolu_restore";

function assistant(id: string, content: unknown[], parent: string | null = null, usage: Record<string, number> = { input_tokens: 2, output_tokens: 8 }, model = "claude-opus-5-5"): SDKMessage {
  return { type: "assistant", message: { id, model, content, usage }, parent_tool_use_id: parent, session_id: "s" } as unknown as SDKMessage;
}

function toolResult(callId: string, parent: string | null = null): SDKMessage {
  return { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: callId, content: "ok" }] }, parent_tool_use_id: parent, session_id: "s" } as unknown as SDKMessage;
}

function taskStarted(taskId: string, toolUseId: string, subagentType?: string, background = false): SDKMessage {
  return { type: "system", subtype: "task_started", task_id: taskId, tool_use_id: toolUseId, description: "Create roadmap", subagent_type: subagentType, is_backgrounded: background, session_id: "s" } as unknown as SDKMessage;
}

function taskProgress(taskId: string): SDKMessage {
  return { type: "system", subtype: "task_progress", task_id: taskId, description: "Reading PROJECT.md", usage: { total_tokens: 21_713, tool_uses: 1, duration_ms: 4326 }, last_tool_name: "Read", session_id: "s" } as unknown as SDKMessage;
}

function taskNotification(taskId: string, toolUseId: string, usage?: Record<string, number>): SDKMessage {
  return { type: "system", subtype: "task_notification", task_id: taskId, tool_use_id: toolUseId, status: "completed", summary: "## ROADMAP CREATED", usage, session_id: "s" } as unknown as SDKMessage;
}

function heartbeat(callId: string): SDKMessage {
  return { type: "tool_progress", tool_use_id: `${callId}-heartbeat-0`, tool_name: "Agent", parent_tool_use_id: callId, elapsed_time_seconds: 30, heartbeat: true, session_id: "s" } as unknown as SDKMessage;
}

// An in-process tool's heartbeat names its own call as its parent (run 4414, CLI 2.1.286).
function ownHeartbeat(callId: string, toolName: string): SDKMessage {
  return { type: "tool_progress", tool_use_id: callId, tool_name: toolName, parent_tool_use_id: callId, elapsed_time_seconds: 29, session_id: "s" } as unknown as SDKMessage;
}

function result(numTurns: number, costUsd: number, modelUsage: Record<string, Record<string, number>>, subtype = "success"): SDKMessage {
  return { type: "result", subtype, is_error: false, num_turns: numTurns, duration_ms: 1000, total_cost_usd: costUsd, modelUsage, errors: [], session_id: "s" } as unknown as SDKMessage;
}

function modelTotals(inputTokens: number, outputTokens: number): Record<string, number> {
  return { inputTokens, outputTokens, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
}

function mapAll(mapper: MessageMapper, messages: SDKMessage[]): EventBody[] {
  return messages.flatMap((message) => mapper.map(message));
}

function ofType<Type extends EventBody["type"]>(events: EventBody[], type: Type): Extract<EventBody, { type: Type }>[] {
  return events.filter((event): event is Extract<EventBody, { type: Type }> => event.type === type);
}

function summedOutput(events: EventBody[], model: string): number {
  return ofType(events, "usage").filter((event) => event.model === model).reduce((sum, event) => sum + event.outputTokens, 0);
}

describe("MessageMapper sub-sessions", () => {
  it("opens a sub-session on task_started, routes its frames by parent_tool_use_id and closes it with its usage", () => {
    const mapper = new MessageMapper();

    const events = mapAll(mapper, [
      assistant("m1", [{ type: "tool_use", id: AGENT_CALL, name: "Agent", input: { subagent_type: "gsd-roadmapper" } }]),
      taskStarted("a09e", AGENT_CALL, "gsd-roadmapper"),
      assistant("m2", [{ type: "tool_use", id: "toolu_read", name: "Read", input: {} }], AGENT_CALL, { input_tokens: 2, output_tokens: 8 }, "claude-sonnet-5-5"),
      toolResult("toolu_read", AGENT_CALL),
      heartbeat(AGENT_CALL),
      taskProgress("a09e"),
      taskNotification("a09e", AGENT_CALL, { total_tokens: 69_393, tool_uses: 17, duration_ms: 140_983 }),
      toolResult(AGENT_CALL),
    ]);

    assert.deepEqual(events.map((event) => [event.type, event.sessionId]), [
      ["tool_call", undefined],
      ["session_start", AGENT_CALL],
      ["tool_call", AGENT_CALL],
      ["tool_result", AGENT_CALL],
      ["tool_progress", AGENT_CALL],
      ["session_progress", AGENT_CALL],
      ["session_end", AGENT_CALL],
      ["tool_result", undefined],
    ]);
    assert.deepEqual(ofType(events, "session_start")[0], {
      type: "session_start",
      sessionId: AGENT_CALL,
      parentSessionId: null,
      kind: "subagent",
      name: "gsd-roadmapper",
      description: "Create roadmap",
      taskId: "a09e",
      background: false,
      inferred: false,
    });
    assert.deepEqual(ofType(events, "tool_progress")[0], { type: "tool_progress", callId: AGENT_CALL, name: "Agent", elapsedMs: 30_000, sessionId: AGENT_CALL });
    assert.deepEqual(ofType(events, "session_end")[0], {
      type: "session_end",
      sessionId: AGENT_CALL,
      status: "completed",
      summary: "## ROADMAP CREATED",
      totalTokens: 69_393,
      toolUses: 17,
      durationMs: 140_983,
    });
  });

  it("nests a session started by a sub-agent's call under that sub-agent", () => {
    const mapper = new MessageMapper();

    const events = mapAll(mapper, [
      taskStarted("outer", AGENT_CALL, "gsd-planner"),
      assistant("m1", [{ type: "tool_use", id: "toolu_inner", name: "Agent", input: {} }], AGENT_CALL),
      taskStarted("inner", "toolu_inner", "gsd-pattern-mapper"),
    ]);

    assert.deepEqual(ofType(events, "session_start").map((event) => [event.sessionId, event.parentSessionId]), [
      [AGENT_CALL, null],
      ["toolu_inner", AGENT_CALL],
    ]);
  });

  it("opens an inferred session for a frame that comes before its task_started, and completes it then", () => {
    const mapper = new MessageMapper();
    const early = { ...assistant("m1", [{ type: "tool_use", id: "toolu_read", name: "Read", input: {} }], AGENT_CALL), subagent_type: "gsd-planner", task_description: "Plan Phase 1" } as SDKMessage;

    const events = mapAll(mapper, [early, taskStarted("a8a1", AGENT_CALL, "gsd-planner", true), toolResult("toolu_read", AGENT_CALL)]);

    assert.deepEqual(events.map((event) => event.type), ["session_start", "tool_call", "session_start", "tool_result"]);
    assert.deepEqual(ofType(events, "session_start").map((event) => [event.sessionId, event.name, event.description, event.taskId, event.background, event.inferred]), [
      [AGENT_CALL, "gsd-planner", "Plan Phase 1", null, null, true],
      [AGENT_CALL, "gsd-planner", "Create roadmap", "a8a1", true, false],
    ]);
  });

  it("ends an inferred session that never got its task_started as unfinished", () => {
    const mapper = new MessageMapper();

    mapAll(mapper, [heartbeat(AGENT_CALL)]);

    const finished = mapper.finish(null);

    assert.deepEqual(finished.map((event) => [event.type, event.sessionId]), [["session_end", AGENT_CALL], ["result", undefined]]);
  });

  it("does not reopen a session for a late frame after its task_notification", () => {
    const mapper = new MessageMapper();

    const events = mapAll(mapper, [taskStarted("a09e", AGENT_CALL, "gsd-roadmapper"), taskNotification("a09e", AGENT_CALL), heartbeat(AGENT_CALL)]);

    assert.deepEqual(events.map((event) => event.type), ["session_start", "session_end", "tool_progress"]);
  });

  it("maps a background Bash task as a background task, not a sub-agent", () => {
    const mapper = new MessageMapper();

    const events = mapAll(mapper, [taskStarted("bgrns7vm8", BASH_CALL, undefined, true), taskNotification("bgrns7vm8", BASH_CALL)]);

    const started = ofType(events, "session_start")[0];
    const ended = ofType(events, "session_end")[0];

    assert.equal(started.kind, "background_task");
    assert.equal(started.name, null);
    assert.equal(started.background, true);
    assert.equal(ended.status, "completed");
    assert.equal(ended.totalTokens, null);
  });

  it("ends sessions still open at the end of the run as unfinished, before the result", () => {
    const mapper = new MessageMapper();

    mapAll(mapper, [taskStarted("a8a1", AGENT_CALL, "gsd-planner", true), result(73, 6.09, {})]);

    const finished = mapper.finish("timeout");

    assert.deepEqual(finished.map((event) => event.type), ["session_end", "result"]);
    assert.equal(ofType(finished, "session_end")[0].status, "unfinished");
  });

  it("keeps a long tool call's own heartbeat in the caller's session, not as a sub-agent of the call", () => {
    const mapper = new MessageMapper();

    const events = mapAll(mapper, [
      assistant("m1", [{ type: "tool_use", id: RESTORE_CALL, name: "mcp__agent__sandbox_restore", input: {} }]),
      ownHeartbeat(RESTORE_CALL, "mcp__agent__sandbox_restore"),
    ]);

    assert.deepEqual(events.map((event) => [event.type, event.sessionId]), [["tool_call", undefined], ["tool_progress", undefined]]);
    assert.deepEqual(ofType(mapper.finish(null), "session_end"), []);
  });

  it("puts a tool's heartbeat and its own reports in the sub-agent that made the call", () => {
    const mapper = new MessageMapper();

    const events = mapAll(mapper, [
      taskStarted("a09e", AGENT_CALL, "gsd-executor"),
      assistant("m1", [{ type: "tool_use", id: RESTORE_CALL, name: "mcp__agent__sandbox_restore", input: {} }], AGENT_CALL),
      ownHeartbeat(RESTORE_CALL, "mcp__agent__sandbox_restore"),
    ]);
    const reported = mapper.mapToolReports([{ type: "tool_progress", callId: RESTORE_CALL, name: "sandbox_restore", elapsedMs: 30_000, detail: "step 1/1" }]);

    assert.deepEqual(ofType(events, "tool_progress").map((event) => event.sessionId), [AGENT_CALL]);
    assert.deepEqual(reported, [{ type: "tool_progress", callId: RESTORE_CALL, name: "sandbox_restore", elapsedMs: 30_000, detail: "step 1/1", sessionId: AGENT_CALL }]);
  });

  it("leaves a main-session call's report in the main session", () => {
    const mapper = new MessageMapper();

    const reported = mapper.mapToolReports([{ type: "tool_progress", callId: RESTORE_CALL, name: "sandbox_restore", elapsedMs: 1, detail: "copying" }]);

    assert.equal(reported[0].sessionId, undefined);
  });
});

describe("MessageMapper run result", () => {
  it("keeps several result messages as turns and gives one run result from the last at the end", () => {
    const mapper = new MessageMapper();

    const streamed = mapAll(mapper, [
      result(73, 6.09, { "claude-opus-5-5": modelTotals(96, 60_106) }),
      taskNotification("a8a1", AGENT_CALL),
      result(3, 8.73, { "claude-opus-5-5": modelTotals(170, 91_574) }, "error_during_execution"),
      result(4, 11.89, { "claude-opus-5-5": modelTotals(230, 153_608) }),
    ]);

    const finished = mapper.finish(null);

    assert.equal(ofType(streamed, "result").length, 0);
    assert.deepEqual(finished, [{ type: "result", reason: "success", turns: 80, durationMs: 3000, providerCostUsd: 11.89, message: null }]);
  });

  it("sums usage events to the last result's per-model totals, without sub-agent frame usage", () => {
    const mapper = new MessageMapper();

    const events = mapAll(mapper, [
      assistant("m1", [{ type: "text", text: "start" }], null, { input_tokens: 10, output_tokens: 100 }),
      assistant("m2", [{ type: "text", text: "sub" }], AGENT_CALL, { input_tokens: 2, output_tokens: 8 }, "claude-sonnet-5-5"),
      result(1, 1, { "claude-opus-5-5": modelTotals(10, 150), "claude-sonnet-5-5": modelTotals(40, 900) }),
      assistant("m3", [{ type: "text", text: "next" }], null, { input_tokens: 5, output_tokens: 50 }),
      result(1, 2, { "claude-opus-5-5": modelTotals(15, 260), "claude-sonnet-5-5": modelTotals(40, 1200) }),
    ]);

    assert.equal(summedOutput(events, "claude-opus-5-5"), 260);
    assert.equal(summedOutput(events, "claude-sonnet-5-5"), 1200);
  });

  it("keeps the usage of a turn cut short by the stop, before the result", () => {
    const mapper = new MessageMapper();

    mapper.map(assistant("m1", [{ type: "text", text: "working" }], null, { input_tokens: 10, output_tokens: 40 }));

    const finished = mapper.finish("timeout");

    assert.deepEqual(finished.map((event) => event.type), ["usage", "result"]);
    assert.equal(summedOutput(finished, "claude-opus-5-5"), 40);
  });

  it("reports the stop reason of a run stopped after a result", () => {
    const mapper = new MessageMapper();

    mapper.map(result(73, 6.09, {}));

    const [finished] = mapper.finish("aborted");

    assert.deepEqual(finished, { type: "result", reason: "aborted", turns: 73, durationMs: 1000, providerCostUsd: 6.09, message: "aborted" });
  });

  it("fails a run whose stream ended without a result", () => {
    const [finished] = new MessageMapper().finish(null);

    assert.deepEqual(finished, { type: "result", reason: "failed", turns: 0, durationMs: 0, providerCostUsd: null, message: null });
  });
});

describe("MessageMapper tool names", () => {
  it("names the sub-agent tool Agent whether the SDK calls it Agent or Task", () => {
    const mapper = new MessageMapper();

    const events = mapAll(mapper, [assistant("m1", [
      { type: "tool_use", id: "toolu_1", name: "Agent", input: {} },
      { type: "tool_use", id: "toolu_2", name: "Task", input: {} },
      { type: "tool_use", id: "toolu_3", name: "mcp__agent__read_pbi", input: {} },
    ])]);

    assert.deepEqual(ofType(events, "tool_call").map((event) => event.name), ["Agent", "Agent", "read_pbi"]);
  });
});
