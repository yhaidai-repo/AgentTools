import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { messageResult } from "./messageResult";

describe("messageResult", () => {
  it("shows a command's message, or its error", () => {
    assert.deepEqual(messageResult({ ok: true, value: { message: "Synced." } }), { ok: true, message: "Synced." });
    assert.deepEqual(messageResult({ ok: false, error: "No vault." }), { ok: false, message: "No vault." });
  });
});
