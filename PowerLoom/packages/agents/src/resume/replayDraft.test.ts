import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentEvent, ConversationStore, PastToolCall, ToolDefinition } from "@agenttools/runtime";
import { ReadLog } from "../evidence/ReadLog";
import { recordReads } from "../evidence/recordReads";
import { replayDraft } from "./replayDraft";

function storeWith(calls: PastToolCall[]): ConversationStore {
  return { exists: async () => true, toolCalls: async () => calls, remove: async () => undefined };
}

function past(name: string, input: unknown, output = "ok", isError = false): PastToolCall {
  return { callId: `${name}-${JSON.stringify(input)}`, name, input, isError, output };
}

function tool(name: string, replayOnResume: boolean, seen: unknown[], failWith: string | null = null): ToolDefinition<any> {
  return {
    name,
    description: name,
    input: {},
    handler: async (input) => {
      seen.push(input);

      return failWith ? { text: failWith, isError: true } : { text: "ok" };
    },
    replayOnResume,
  };
}

describe("replaying a continued run's draft", () => {
  it("calls again only the successful calls of replayable tools, in order", async () => {
    const drafted: unknown[] = [];
    const read: unknown[] = [];
    const calls = [past("read_note", { path: "a" }), past("record_decision", { note: "a" }), past("record_decision", { note: "b" }, "bad", true), past("record_decision", { note: "c" })];

    const report = await replayDraft(storeWith(calls), "c-1", [tool("read_note", false, read), tool("record_decision", true, drafted)]);

    assert.deepEqual(drafted, [{ note: "a" }, { note: "c" }]);
    assert.deepEqual(read, []);
    assert.deepEqual(report, { replayed: { record_decision: 2 }, restored: 0, failed: [] });
  });

  it("reports a call that fails this time", async () => {
    const report = await replayDraft(storeWith([past("fix_link", {})]), "c-1", [tool("fix_link", true, [], "note gone")]);

    assert.deepEqual(report, { replayed: {}, restored: 0, failed: ["fix_link: note gone"] });
  });

  it("restores recorded reads under their ids without reading again, and numbers new reads after them", async () => {
    const log = new ReadLog("first message");
    const read: unknown[] = [];
    const [readFile] = recordReads([tool("read_file", false, read)], log);
    const calls = [past("read_file", { path: "a.ts" }, "code of a\n\n[source S1]"), past("read_file", { path: "c.ts" }, "code of c\n\n[source S3]")];

    const report = await replayDraft(storeWith(calls), "c-1", [readFile]);

    assert.deepEqual(read, []);
    assert.equal(report.restored, 2);
    assert.equal(log.find("S1")?.text, '{"path":"a.ts"}\ncode of a');
    assert.equal(log.find("S3")?.text, '{"path":"c.ts"}\ncode of c');
    assert.equal(log.add("new read"), "S4");
  });

  it("shows the SDK's own web calls to the run's observer", async () => {
    const seen: AgentEvent[] = [];

    await replayDraft(storeWith([past("WebFetch", { url: "https://x.dev" }, "page")]), "c-1", [], (event) => seen.push(event));

    assert.deepEqual(seen.map((event) => event.type), ["tool_call", "tool_result"]);
  });
});
