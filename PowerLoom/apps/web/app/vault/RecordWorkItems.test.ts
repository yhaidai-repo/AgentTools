import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecordWorkItems } from "./RecordWorkItems";

it("shows creation/update origins with task and PBI links and the actual chat id", () => {
  const html = renderToStaticMarkup(createElement(RecordWorkItems, { references: [{ action: "created", pbiId: 7, taskId: "TT-7-001", chatId: "codex-123", sessionId: "fallback" }, { action: "updated", date: "2026-10-29", sessionId: "mcp-456" }] }));
  assert.match(html, /href="\/pbis\/7"/);
  assert.match(html, /href="\/tasks\/TT-7-001"/);
  assert.match(html, /Created in/);
  assert.match(html, /Updated in.*2026-10-29/);
  assert.match(html, /Chat codex-123/);
  assert.match(html, /MCP session mcp-456/);
  assert.doesNotMatch(html, /fallback/);
});
