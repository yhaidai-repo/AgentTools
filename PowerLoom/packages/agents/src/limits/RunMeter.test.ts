import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentEvent } from "@agenttools/runtime";
import { REPLAY_RUN } from "../resume/replayDraft";
import { RunMeter } from "./RunMeter";

const at = new Date();

function call(runId: string): AgentEvent {
  return { type: "tool_call", callId: "c", name: "read_file", input: {}, runId, seq: 1, at };
}

function text(words: string): AgentEvent {
  return { type: "text", text: words, runId: "7", seq: 1, at };
}

describe("run meter", () => {
  it("counts the run's own tool calls, not a replay's", () => {
    const meter = new RunMeter();

    [call("7"), call("7"), call(REPLAY_RUN)].forEach((event) => meter.observe(event));

    assert.equal(meter.toolCalls, 2);
  });

  it("keeps the agent's last three texts as its last words", () => {
    const meter = new RunMeter();

    ["one", "two", " three ", "four"].forEach((words) => meter.observe(text(words)));

    assert.equal(meter.lastWords, "two\n\nthree\n\nfour");
  });
});
