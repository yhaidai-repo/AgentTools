import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executionProgress, progressPercent, stepTone } from "./stepLooks";

describe("stepTone", () => {
  it("folds the task statuses into the canvas tones", () => {
    assert.equal(stepTone("pending"), "pending");
    assert.equal(stepTone("skipped"), "skipped");
    assert.equal(stepTone("open"), "open");
    assert.equal(stepTone("in-progress"), "running");
    assert.equal(stepTone("done"), "done");
    assert.equal(stepTone("answered"), "done");
    assert.equal(stepTone("blocked"), "blocked");
    assert.equal(stepTone("cancelled"), "cancelled");
    assert.equal(stepTone("dismissed"), "cancelled");
    assert.equal(stepTone("something-new"), "open");
  });
});

describe("executionProgress", () => {
  it("counts done steps over the non-skipped ones", () => {
    const steps = [{ status: "done" }, { status: "in-progress" }, { status: "pending" }, { status: "skipped" }, { status: "answered" }] as const;

    assert.deepEqual(executionProgress(steps), { done: 2, total: 4 });
    assert.equal(progressPercent({ done: 2, total: 4 }), 50);
    assert.equal(progressPercent({ done: 0, total: 0 }), 0);
  });
});
