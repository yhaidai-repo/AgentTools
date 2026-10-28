import assert from "node:assert/strict";
import { it } from "node:test";
import { parseRegisterRecords } from "./parseRegisterRecords";
import { parseWwwRecords } from "../www/wwwLog";
import { parseRecordWorkReferences, recordWorkLine, withRecordWorkReferences } from "./recordWorkReferences";

const PATH = "shop/shop-known-issues.md";
const original = "# Known issues\n\n## KI-001 Wrong total\n> **Open** · Created 2026-10-01 · Updated 2026-10-01\n\n**Issue**: Sums twice.\n";

it("records creation and subsequent updates, preserves original context through rewrites, and is idempotent", () => {
  const created = withRecordWorkReferences(PATH, "", original, { pbiId: 7, taskId: "WT-002" }, "2026-10-01");
  const rewritten = original.replace("Sums twice.", "Includes tax twice."); // a writer omitted the old provenance
  const updated = withRecordWorkReferences(PATH, created, rewritten, { chatId: "codex-123", sessionId: "mcp-456" }, "2026-10-29");
  assert.deepEqual(parseRegisterRecords(updated)[0].workItems, [
    { action: "created", date: "2026-10-01", pbiId: 7, taskId: "WT-002" },
    { action: "updated", date: "2026-10-29", chatId: "codex-123" },
  ]);
  assert.equal(withRecordWorkReferences(PATH, updated, updated, { taskId: "WT-003" }, "2026-10-29"), updated);
  assert.ok(!updated.includes("mcp-456"));
});

it("adds only update context to legacy records, and does not attribute untouched records or ordinary notes", () => {
  const second = original.replaceAll("KI-001", "KI-002");
  const before = original + "\n" + second;
  const updated = withRecordWorkReferences(PATH, before, before.replace("Sums twice.", "Fixed."), { taskId: "VR-003" }, "2026-10-29");
  assert.deepEqual(parseRegisterRecords(updated).map((record) => record.workItems), [[{ action: "updated", date: "2026-10-29", taskId: "VR-003" }], undefined]);
  assert.equal(withRecordWorkReferences("shop/notes.md", original, second, { taskId: "WT-004" }, "2026-10-29"), second);
});

it("reads WWW and CRLF history with MCP fallback and refuses unsafe ids", () => {
  const text = "## WWW-001 Miss\r\n- Status: open\r\n- Created in: 2026-10-01 · session:mcp-123\r\n";
  const updated = withRecordWorkReferences("www-log.md", text, text.replace("open", "resolved"), { taskId: "VR-003" }, "2026-10-29");
  assert.deepEqual(parseWwwRecords(updated)[0].workItems, [{ action: "created", date: "2026-10-01", sessionId: "mcp-123" }, { action: "updated", date: "2026-10-29", taskId: "VR-003" }]);
  assert.ok(updated.includes("\r\n- Updated in:"));
  assert.equal(recordWorkLine("created", { chatId: "bad\n## KI-999 Fake", sessionId: "good-session" }), "- Created in: session:good-session");
  assert.deepEqual(parseRecordWorkReferences("- Created in: chat:[bad](javascript:alert)"), []);
});
