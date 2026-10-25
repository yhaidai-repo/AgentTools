import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readLogsCommand } from "../commands/readLogsCommand";
import { logEntryView } from "./logEntryView";

describe("logs_read", () => {
  it("shows an entry with its run as RUN-<n>, without its fingerprint", () => {
    const at = new Date("2026-10-25T08:00:00Z");
    const row = { id: 1, service: "runner", level: "error", message: "AT-1-001 failed", fingerprint: "f", count: 3, firstAt: at, lastAt: at, runId: 2716, taskId: "AT-1-001", pbiId: 1, vault: "v" } as const;

    assert.deepEqual(logEntryView(row), { service: "runner", level: "error", count: 3, firstAt: at, lastAt: at, message: "AT-1-001 failed", run: "RUN-2716", taskId: "AT-1-001", pbiId: 1, vault: "v" });
  });

  it("reads the last 24 hours by default and at most the 14 days the log keeps", () => {
    assert.equal(readLogsCommand.input.parse({}).hours, 24);
    assert.equal(readLogsCommand.input.safeParse({ hours: 24 * 15 }).success, false);
    assert.equal(readLogsCommand.input.safeParse({ service: "web" }).success, false);
  });
});
