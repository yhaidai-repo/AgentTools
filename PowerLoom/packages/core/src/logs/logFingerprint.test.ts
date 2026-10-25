import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { logFingerprint, logMessage, MAX_LOG_MESSAGE } from "./logFingerprint";

describe("logFingerprint", () => {
  const entry = { service: "runner", level: "error" as const, message: "RUN-5 failed: retry in 30000 ms", taskId: "AT-1-001" };

  it("merges repeats that differ only in their numbers", () => {
    assert.equal(logFingerprint(entry), logFingerprint({ ...entry, message: "RUN-6 failed: retry in 60000 ms" }));
  });

  it("keeps apart another service, level, task or message", () => {
    const others = [{ ...entry, service: "mcp" }, { ...entry, level: "warn" as const }, { ...entry, taskId: "AT-1-002" }, { ...entry, message: "RUN-5 timed out" }];

    assert.equal(new Set([entry, ...others].map(logFingerprint)).size, 5);
  });
});

describe("logMessage", () => {
  it("cuts a huge message to the limit", () => {
    assert.equal(logMessage("x".repeat(5000)).length, MAX_LOG_MESSAGE);
    assert.equal(logMessage("short"), "short");
  });
});
