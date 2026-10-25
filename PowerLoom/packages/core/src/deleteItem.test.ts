import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDeletableItem } from "./deleteItem";

describe("isDeletableItem", () => {
  it("offers delete on every open question and task, a test task and a task type of its own too, but not on a result", () => {
    assert.equal(isDeletableItem({ kind: "test", status: "open" }), true);
    assert.equal(isDeletableItem({ kind: "security-review", status: "open" }), true);
    assert.equal(isDeletableItem({ kind: "question", status: "open" }), true);
    assert.equal(isDeletableItem({ kind: "test-report", status: "done" }), false);
    assert.equal(isDeletableItem({ kind: "test", status: "in-progress" }), false);
  });
});
