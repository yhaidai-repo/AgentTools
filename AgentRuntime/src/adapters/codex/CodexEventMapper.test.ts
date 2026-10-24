import assert from "node:assert/strict";
import { test } from "node:test";
import type { McpToolCallItem, ThreadItem } from "@openai/codex-sdk";
import { CodexEventMapper } from "./CodexEventMapper";
import { codexInstructions, codexToolNamer, neutralCodexToolName } from "./codexToolNames";

const call: McpToolCallItem = { id: "c1", type: "mcp_tool_call", server: "agent", tool: "mcp__agent__read_note", arguments: { path: "a" }, status: "in_progress" };

test("maps MCP calls once and keeps neutral tool names", () => {
  const mapper = new CodexEventMapper("test");

  assert.deepEqual(mapper.map({ type: "item.started", item: call }), [{ type: "tool_call", callId: "c1", name: "read_note", input: { path: "a" } }]);
  assert.deepEqual(mapper.map({ type: "item.updated", item: call }), []);
  assert.deepEqual(mapper.map({ type: "item.completed", item: { ...call, status: "completed", result: { content: [{ type: "text", text: "result" }], structured_content: null } } }),
    [{ type: "tool_result", callId: "c1", isError: false, output: "result" }]);
  assert.deepEqual(mapper.map({ type: "item.completed", item: call }), []);
  assert.equal(mapper.turns, 1);
});

test("supplies a call when the SDK only emits completion and marks errors", () => {
  const mapper = new CodexEventMapper("test");
  const events = mapper.map({ type: "item.completed", item: { ...call, status: "failed", error: { message: "bad input" } } });

  assert.equal(events.length, 2);
  assert.deepEqual(events[1], { type: "tool_result", callId: "c1", isError: true, output: "bad input" });
});

test("maps web search and unexpected built-ins into visible tool events", () => {
  const mapper = new CodexEventMapper("test");

  assert.equal(mapper.map({ type: "item.completed", item: { id: "web", type: "web_search", query: "query" } }).length, 2);
  assert.deepEqual(mapper.map({ type: "item.completed", item: { id: "cmd", type: "command_execution", command: "x", aggregated_output: "denied", exit_code: 1, status: "failed" } })[1],
    { type: "tool_result", callId: "cmd", isError: true, output: "denied" });
  assert.equal(mapper.map({ type: "item.completed", item: { id: "patch", type: "file_change", changes: [], status: "failed" } }).length, 2);
  assert.equal(mapper.turns, 0);
});

test("rewrites whole neutral names without double prefixes or matching longer words", () => {
  const tools = [{ name: "read_note", description: "", input: {}, handler: async () => ({ text: "" }) }];
  const name = codexToolNamer(tools);

  assert.equal(name("read_note mcp__agent__read_note read_notes"), "mcp__agent__read_note mcp__agent__read_note read_notes");
  assert.equal(neutralCodexToolName("read_note"), "read_note");
  assert.ok(codexInstructions("Use read_note", tools).includes("read_note = mcp__agent__read_note"));
});

test("keeps previously unknown provider built-in items visible in the trace", () => {
  const mapper = new CodexEventMapper("test");
  const item = { id: "provider", type: "provider_tool", status: "failed", detail: "denied" } as unknown as ThreadItem;
  const events = mapper.map({ type: "item.completed", item });

  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { type: "tool_call", callId: "provider", name: "codex_provider_tool", input: item });
  assert.deepEqual(events[1], { type: "tool_result", callId: "provider", isError: true, output: JSON.stringify(item) });
});
