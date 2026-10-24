import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerOf } from "./azureMcpAnswer";

describe("answerOf", () => {
  it("turns a 200 into the results as text with the first list's length as rows", () => {
    const answer = answerOf(JSON.stringify({ status: 200, message: "Success", results: { groups: [{ name: "a" }, { name: "b" }] }, duration: 3 }), false);

    assert.equal(answer.ok, true);
    assert.deepEqual(answer.ok && [answer.rows, answer.text.includes('"name": "b"')], [2, true]);
  });

  it("marks a 403, a wrapped 401 and the shim's az login sentence as denied, other failures as not", () => {
    const forbidden = answerOf(JSON.stringify({ status: 403, message: "The provided authentication is not valid for this resource" }), true);
    const wrapped = answerOf(JSON.stringify({ status: 500, message: "Service request failed.\nStatus: 401 (Unauthorized)" }), true);
    const signedOut = answerOf("ERROR: Please run 'az login' to setup account.", true);
    const semantic = answerOf(JSON.stringify({ status: 400, message: "'summarize' operator: Failed to resolve table" }), true);

    assert.deepEqual([forbidden.ok, wrapped.ok, signedOut.ok, semantic.ok], [false, false, false, false]);
    assert.deepEqual([!forbidden.ok && forbidden.denied, !wrapped.ok && wrapped.denied, !signedOut.ok && signedOut.denied, !semantic.ok && semantic.denied], [true, true, true, false]);
  });

  it("cuts a wide result and says so", () => {
    const answer = answerOf(JSON.stringify({ status: 200, message: "", results: { items: [{ blob: "x".repeat(70_000) }] } }), false);

    assert.equal(answer.ok, true);
    assert.match(answer.ok ? answer.text : "", /\[cut at 60000 of \d+ characters/);
  });
});
