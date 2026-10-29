import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NOT_FAILED_OUTCOMES, STOPPED_OUTCOMES, USER_STOP_OUTCOME, isFailedOutcome, isStoppedOutcome } from "./runs";

describe("run outcomes that count as failures", () => {
  it("counts a run the user stopped as stopped, not failed, like a budget stop", () => {
    assert.equal(USER_STOP_OUTCOME, "aborted");
    assert.deepEqual(STOPPED_OUTCOMES, ["budget-exceeded", "aborted"]);
    assert.equal(isStoppedOutcome("aborted"), true);
    assert.equal(isStoppedOutcome("budget-exceeded"), true);
    assert.equal(isFailedOutcome("aborted"), false);
    assert.equal(isFailedOutcome("budget-exceeded"), false);
  });

  it("leaves the stops out of the failure counts and lists, which filter on NOT_FAILED_OUTCOMES", () => {
    assert.deepEqual(NOT_FAILED_OUTCOMES, ["success", "no-op", "running", "budget-exceeded", "aborted"]);
  });

  it("counts every other ending as a failure", () => {
    for (const outcome of ["failed", "gate-rejected", "rate-limited", "timeout", "max-turns"]) {
      assert.equal(isFailedOutcome(outcome), true, outcome);
      assert.equal(isStoppedOutcome(outcome), false, outcome);
    }
  });
});
