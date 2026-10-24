import assert from "node:assert/strict";
import { test } from "node:test";
import { CodexToolHistory } from "./CodexToolHistory";

test("returns call order when parallel calls finish in reverse order", () => {
  const history = new CodexToolHistory();

  for (const id of ["first", "second"]) {
    history.add({ type: "response_item", payload: { type: "function_call", call_id: id, name: "mcp__agent__read_note", arguments: "{}" } });
  }

  for (const id of ["second", "first"]) {
    history.add({ type: "response_item", payload: { type: "function_call_output", call_id: id, output: id } });
  }

  assert.deepEqual(history.results().map((call) => call.callId), ["first", "second"]);
});

// Shortened real item_completed payload captured by the approved Codex SDK smoke on 2026-10-24.
test("reads the persisted code-mode MCP event rather than evaluating its JavaScript wrapper", () => {
  const history = new CodexToolHistory();

  history.add({
    type: "event_msg",
    payload: {
      type: "item_completed", thread_id: "thread", turn_id: "turn",
      item: { type: "McpToolCall", id: "exec-tool", server: "agent", tool: "verify_tool", arguments: {}, readOnlyHint: true, status: "completed",
        result: { content: [{ type: "text", text: "powerloom-connected" }], isError: false }, duration: { secs: 0, nanos: 5141300 } },
      started_at_ms: 1792849179937, completed_at_ms: 1792849179942,
    },
  });

  assert.deepEqual(history.results(), [{ callId: "exec-tool", name: "verify_tool", input: {}, isError: false, output: "powerloom-connected" }]);
});

test("orders persisted code-mode calls by their recorded start time", () => {
  const history = new CodexToolHistory();

  for (const [id, started] of [["second", 200], ["first", 100]] as const) {
    history.add({ type: "event_msg", payload: { type: "item_completed", started_at_ms: started,
      item: { type: "McpToolCall", id, server: "agent", tool: "read_note", arguments: {}, status: "completed", result: { content: [] } } } });
  }

  assert.deepEqual(history.results().map((call) => call.callId), ["first", "second"]);
});

test("does not replay an unfinished persisted call", () => {
  const history = new CodexToolHistory();

  history.add({ type: "item.started", item: { type: "mcp_tool_call", id: "pending", server: "agent", tool: "read_note", arguments: {}, status: "in_progress" } });

  assert.deepEqual(history.results(), []);
});

test("preserves order across timestamped and legacy rollout formats", () => {
  const history = new CodexToolHistory();

  history.add({ type: "event_msg", payload: { type: "item_completed", started_at_ms: 1792849179937,
    item: { type: "McpToolCall", id: "earlier", server: "agent", tool: "read_note", arguments: {}, status: "completed", result: { content: [] } } } });
  history.add({ type: "response_item", payload: { type: "function_call", call_id: "later", name: "mcp__agent__read_note", arguments: "{}" } });
  history.add({ type: "response_item", payload: { type: "function_call_output", call_id: "later", output: "later" } });

  assert.deepEqual(history.results().map((call) => call.callId), ["earlier", "later"]);
});
